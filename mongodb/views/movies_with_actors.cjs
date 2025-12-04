// file: C:\_dev\repos\v0-db-api\mongodb\views\movies_with_actors.cjs
const clientPromise = require("../../src/config/db");

(async () => {
  let client;
  try {
    client = await clientPromise;
    const db = client.db("maga-movies");

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
        { $match: { "fullDetails.origin_country": "US" } },
        { $match: { poster_path: { $ne: null } } },
        { $match: { release_date: { $lt: new Date().toISOString().split('T')[0] } } },

        // Extract highest-billed female actress
        {
          $addFields: {
            leadFemaleCast: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$credits.cast",
                    as: "c",
                    cond: { $eq: ["$$c.gender", 1] }
                  }
                },
                0
              ]
            }
          }
        },
        { $match: { leadFemaleCast: { $ne: null } } },

        {
          $addFields: {
            leadActressId: "$leadFemaleCast.id",
            leadActressName: "$leadFemaleCast.name"
          }
        },

        // Join with custom actors collection
        {
          $lookup: {
            from: "actors",
            localField: "leadActressId",
            foreignField: "id",
            as: "leadActressDoc"
          }
        },
        { $unwind: { path: "$leadActressDoc", preserveNullAndEmptyArrays: true } },

        // CRITICAL FILTER: only caucasian OR missing (to be fixed)
        {
          $match: {
            $or: [
              { leadActressDoc: null },
              { "leadActressDoc.ethnicity": "caucasian" }
            ]
          }
        },

        // Helpful flags + enriched lead actress info
        {
          $addFields: {
            needsEthnicityFix: { $eq: ["$leadActressDoc", null] },
            leadFemaleInfo: {
              id: "$leadActressId",
              name: "$leadActressName",
              ethnicity: { $ifNull: ["$leadActressDoc.ethnicity", null] },
              hot_score: { $ifNull: ["$leadActressDoc.hotScore", null] },
              hair_color: { $ifNull: ["$leadActressDoc.hairColor", null] }
            }
          }
        },

        // Optional: enrich all known actors (for hotScore sorting later)
        {
          $lookup: {
            from: "actors",
            localField: "credits.cast.id",
            foreignField: "id",
            as: "matchingActors"
          }
        },

        // Final projection — only what frontend needs
        {
          $project: {
            id: 1,
            title: 1,
            poster_path: 1,
            release_date: 1,
            vote_average: 1,
            genre_ids: "$genre_ids", 
            leadFemaleInfo: 1,
            needsEthnicityFix: 1,
            providers: { results: { US: "$providers.results.US" } },
            matchingActors: {
              $map: {
                input: "$matchingActors",
                as: "a",
                in: {
                  id: "$$a.id",
                  hotScore: "$$a.hotScore"
                }
              }
            }
          }
        },

        // Always sort newest first (you can override in query if needed)
        { $sort: { release_date: -1 } }
      ]
    });
    console.log("View 'movies_with_lead_caucasian_actress' created successfully.");
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