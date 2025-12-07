// file: C:\_dev\repos\v0-db-api\db\views\movies_with_actors.cjs
const clientPromise = require("../../src/config/db");

(async () => {
  let client;
  try {
    client = await clientPromise;
    const db = client.db("maga-movies");

    // Step 1: Fetch keyword IDs that contain 'gbt' in their name (case-insensitive)
    const keywordsCollection = db.collection("keywords");
    const gbtKeywords = await keywordsCollection
      .find({ name: { $regex: "gbt", $options: "i" } })
      .toArray();
    const gbtKeywordIds = gbtKeywords.map((keyword) => keyword.id);
    console.log(`Found ${gbtKeywordIds.length} keywords with 'gbt' in name.`);

    // Drop the existing view if it exists
    try {
      await db.collection("movies_with_lead_caucasian_actress").drop();
      console.log("Existing view dropped.");
    } catch (err) {
      console.log("No existing view to drop, proceeding to create a new one.");
    }

    // Create the view using an aggregation pipeline
    await db.createCollection("movies_with_lead_caucasian_actress", {
      viewOn: "movies",
      pipeline: [
        { $match: { adult: false } },
        { $match: { "fullDetails.origin_country": "US" } },
        { $match: { "providers.results.US": { $ne: null } } },
        { $match: { poster_path: { $ne: null } } },
        {
          $match: {
            release_date: { $lt: new Date().toISOString().split("T")[0] },
          },
        },

        // Exclude movies with specific keywords (e.g., lgbt, coming out)
        { $match: { "keywords.id": { $nin: gbtKeywordIds } } },

        // Extract highest-billed female actress
        {
          $addFields: {
            leadFemaleCast: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$credits.cast",
                    as: "c",
                    cond: { $eq: ["$$c.gender", 1] },
                  },
                },
                0,
              ],
            },
            leadMaleCast: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$credits.cast",
                    as: "c",
                    cond: { $eq: ["$$c.gender", 2] },
                  },
                },
                0,
              ],
            },
            leadDirector: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$credits.crew",
                    as: "c",
                    cond: { $eq: ["$$c.job", "Director"] },
                  },
                },
                0,
              ],
            },
          },
        },
        { $match: { leadFemaleCast: { $ne: null } } },

        {
          $addFields: {
            leadActressId: "$leadFemaleCast.id",
            leadActressName: "$leadFemaleCast.name",
            leadActorId: "$leadMaleCast.id",
            leadActorName: "$leadMaleCast.name",
            leadDirectorId: "$leadDirector.id",
            leadDirectorName: "$leadDirector.name",
          },
        },

        // Join with custom actors collection for female lead
        {
          $lookup: {
            from: "actors",
            localField: "leadActressId",
            foreignField: "id",
            as: "leadActressDoc",
          },
        },
        {
          $unwind: {
            path: "$leadActressDoc",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Join with custom actors collection for male lead
        {
          $lookup: {
            from: "actors",
            localField: "leadActorId",
            foreignField: "id",
            as: "leadActorDoc",
          },
        },
        {
          $unwind: { path: "$leadActorDoc", preserveNullAndEmptyArrays: true },
        },

        // CRITICAL FILTER: only caucasian OR missing (to be fixed) for female lead
        {
          $match: {
            $or: [
              { leadActressDoc: null },
              { "leadActressDoc.ethnicity": "caucasian" },
            ],
          },
        },

        // Helpful flags + enriched lead actress info
        {
          $addFields: {
            needsEthnicityFix: { $eq: ["$leadActressDoc", null] },
            leadFemaleInfo: {
              id: "$leadActressId",
              name: "$leadActressName",
              profile_path: "$leadFemaleCast.profile_path",
              ethnicity: { $ifNull: ["$leadActressDoc.ethnicity", null] },
              hot_score: { $ifNull: ["$leadActressDoc.hotScore", null] },
              hair_color: { $ifNull: ["$leadActressDoc.hairColor", null] },
              height: { $ifNull: ["$leadActressDoc.heightRange", null] },
              weight: { $ifNull: ["$leadActressDoc.weightRange", null] },
              is_woke: false,
              has_tds: false,
            },
            leadMaleInfo: {
              id: "$leadActorId",
              name: "$leadActorName",
              profile_path: "$leadMaleCast.profile_path",
              ethnicity: { $ifNull: ["$leadActorDoc.ethnicity", null] },
              hot_score: { $ifNull: ["$leadActorDoc.hotScore", null] },
              hair_color: { $ifNull: ["$leadActorDoc.hairColor", null] },
              height: { $ifNull: ["$leadActorDoc.heightRange", null] },
              weight: { $ifNull: ["$leadActorDoc.weightRange", null] },
              is_woke: false,
              has_tds: false,
            },
            leadDirectorInfo: {
              id: "$leadDirectorId",
              profile_path: "$leadDirector.profile_path",
              name: "$leadDirectorName",
              is_woke: false,
              has_tds: false,
            },
          },
        },

        // Optional: enrich all known actors (for hotScore sorting later)
        {
          $lookup: {
            from: "actors",
            localField: "credits.cast.id",
            foreignField: "id",
            as: "matchingActors",
          },
        },

        // Final projection — only what frontend needs
        {
          $project: {
            id: 1,
            title: 1,
            poster_path: 1,
            release_date: 1,
            release_date_id: "$release_dates.id",
            release: {
              $let: {
                vars: {
                  usEntry: {
                    $arrayElemAt: [
                      {
                        $filter: {
                          input: "$release_dates.results",
                          cond: { $eq: ["$$this.iso_3166_1", "US"] },
                        },
                      },
                      0,
                    ],
                  },
                },
                in: { $ifNull: ["$$usEntry.release_dates", []] },
              },
            },
            genre_ids: "$genre_ids",
            keyword_ids: {
              $map: {
                input: "$keywords",
                as: "keyword",
                in: "$$keyword.id",
              },
            },
            leadFemaleInfo: 1,
            leadMaleInfo: 1,
            leadDirectorInfo: 1,
            budget: "$fullDetails.budget",
            revenue: "$fullDetails.revenue",
            runtime: "$fullDetails.runtime",
            providers: "$providers.results.US",
            studio_ids: {
              $map: {
                input: "$fullDetails.production_companies",
                as: "studio",
                in: "$$studio.id",
              },
            },
            actor_ids: {
              $map: {
                input: "$credits.cast",
                as: "actor",
                in: "$$actor.id",
              },
            },
          },
        },

        // Always sort newest first (you can override in query if needed)
        { $sort: { release_date: -1 } },
      ],
    });
    console.log(
      "View 'movies_with_lead_caucasian_actress' created successfully."
    );
  } catch (error) {
    console.error("Error creating view:", error.message);
  } finally {
    // Ensure the client connection is closed to terminate the script
    if (client) {
      await client.close();
      console.log("MongoDB client connection closed.");
    }
    process.exit(0); // Explicitly exit the process to ensure termination
  }
})();
