// file: C:\_dev\repos\v0-db-api\db\scripts\optimize_indexes.js
const clientPromise = require("../../src/config/db");

(async () => {
  let client;
  try {
    client = await clientPromise;
    const db = client.db("maga-movies");
    console.log("Connected to MongoDB database: maga-movies");

    // Analyze the aggregation pipeline from movies_with_actors.cjs
    console.log("Analyzing aggregation pipeline for 'movies_with_actors' view...");

    // The pipeline from movies_with_actors.cjs (copied for analysis)
    const pipeline = [
      { $match: { "adult": false } },
      { $match: { "fullDetails.origin_country": "US" } },
      { $match: { poster_path: { $ne: null } } },
      { $match: { release_date: { $lt: new Date().toISOString().split('T')[0] } } },
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
          },
          leadMaleCast: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$credits.cast",
                  as: "c",
                  cond: { $eq: ["$$c.gender", 2] }
                }
              },
              0
            ]
          },
          leadDirector: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$credits.crew",
                  as: "c",
                  cond: { $eq: ["$$c.job", "Director"] }
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
          leadActressName: "$leadFemaleCast.name",
          leadActorId: "$leadMaleCast.id",
          leadActorName: "$leadMaleCast.name",
          leadDirectorId: "$leadDirector.id",
          leadDirectorName: "$leadDirector.name"
        }
      },
      {
        $lookup: {
          from: "actors",
          localField: "leadActressId",
          foreignField: "id",
          as: "leadActressDoc"
        }
      },
      { $unwind: { path: "$leadActressDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "actors",
          localField: "leadActorId",
          foreignField: "id",
          as: "leadActorDoc"
        }
      },
      { $unwind: { path: "$leadActorDoc", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { leadActressDoc: null },
            { "leadActressDoc.ethnicity": "caucasian" }
          ]
        }
      },
      {
        $addFields: {
          needsEthnicityFix: { $eq: ["$leadActressDoc", null] },
          leadFemaleInfo: {
            id: "$leadActressId",
            name: "$leadActressName",
            ethnicity: { $ifNull: ["$leadActressDoc.ethnicity", null] },
            hot_score: { $ifNull: ["$leadActressDoc.hotScore", null] },
            hair_color: { $ifNull: ["$leadActressDoc.hairColor", null] }
          },
          leadMaleInfo: {
            id: "$leadActorId",
            name: "$leadActorName",
            ethnicity: { $ifNull: ["$leadActorDoc.ethnicity", null] },
            hot_score: { $ifNull: ["$leadActorDoc.hotScore", null] },
            hair_color: { $ifNull: ["$leadActorDoc.hairColor", null] }
          },
          leadDirectorInfo: {
            id: "$leadDirectorId",
            name: "$leadDirectorName"
          }
        }
      },
      {
        $lookup: {
          from: "actors",
          localField: "credits.cast.id",
          foreignField: "id",
          as: "matchingActors"
        }
      },
      {
        $project: {
          id: 1,
          title: 1,
          poster_path: 1,
          release_date: 1,
          vote_average: 1,
          genre_ids: "$genre_ids",
          keyword_ids: {
            $map: {
              input: "$keywords",
              as: "keyword",
              in: "$$keyword.id"
            }
          },
          leadFemaleInfo: 1,
          leadMaleInfo: 1,
          leadDirectorInfo: 1,
          needsEthnicityFix: 1,
          providers: { results: { US: "$providers.results.US" } },
          studio_ids: {
            $map: {
              input: "$fullDetails.production_companies",
              as: "studio",
              in: "$$studio.id"
            }
          },
          actor_ids: {
            $map: {
              input: "$credits.cast",
              as: "actor",
              in: "$$actor.id"
            }
          },
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
      { $sort: { release_date: -1 } }
    ];

    // Identify fields used in $match, $sort, and $lookup for indexing
    const recommendedIndexes = [];

    // Analyze $match stages for filter fields
    pipeline.forEach((stage, index) => {
      if (stage.$match) {
        Object.keys(stage.$match).forEach(field => {
          if (field !== '$or') {
            recommendedIndexes.push({
              collection: "movies",
              field,
              reason: `Used in $match filter at stage ${index}`
            });
          } else {
            // Handle $or conditions
            const orConditions = stage.$match.$or;
            if (Array.isArray(orConditions)) {
              orConditions.forEach(condition => {
                Object.keys(condition).forEach(orField => {
                  recommendedIndexes.push({
                    collection: "movies",
                    field: orField,
                    reason: `Used in $match $or filter at stage ${index}`
                  });
                });
              });
            }
          }
        });
      }
    });

    // Analyze $sort stages
    pipeline.forEach((stage, index) => {
      if (stage.$sort) {
        Object.keys(stage.$sort).forEach(field => {
          recommendedIndexes.push({
            collection: "movies",
            field,
            reason: `Used in $sort at stage ${index}`
          });
        });
      }
    });

    // Analyze $lookup stages for join fields
    pipeline.forEach((stage, index) => {
      if (stage.$lookup) {
        recommendedIndexes.push({
          collection: stage.$lookup.from,
          field: stage.$lookup.foreignField,
          reason: `Used in $lookup foreignField at stage ${index}`
        });
        recommendedIndexes.push({
          collection: "movies",
          field: stage.$lookup.localField,
          reason: `Used in $lookup localField at stage ${index}`
        });
      }
    });

    // Display recommended indexes
    console.log("\nRecommended Indexes for Optimization:");
    console.table(recommendedIndexes);

    // Create indexes on the 'movies' and 'actors' collections
    console.log("\nCreating recommended indexes...");

    // For 'movies' collection
    const movieIndexes = recommendedIndexes
      .filter(idx => idx.collection === "movies")
      .map(idx => ({ key: { [idx.field]: 1 }, name: `idx_${idx.field.replace(/\./g, '_')}` }));

    for (const index of movieIndexes) {
      try {
        await db.collection("movies").createIndex(index.key, { name: index.name });
        console.log(`Created index on movies: ${index.name}`);
      } catch (err) {
        console.error(`Failed to create index on movies: ${index.name}`, err.message);
      }
    }

    // For 'actors' collection
    const actorIndexes = recommendedIndexes
      .filter(idx => idx.collection === "actors")
      .map(idx => ({ key: { [idx.field]: 1 }, name: `idx_${idx.field.replace(/\./g, '_')}` }));

    for (const index of actorIndexes) {
      try {
        await db.collection("actors").createIndex(index.key, { name: index.name });
        console.log(`Created index on actors: ${index.name}`);
      } catch (err) {
        console.error(`Failed to create index on actors: ${index.name}`, err.message);
      }
    }

    console.log("Index creation completed.");
  } catch (error) {
    console.error("Error in index optimization script:", error.message);
  } finally {
    if (client) {
      await client.close();
      console.log("MongoDB client connection closed.");
    }
    process.exit(0);
  }
})();
