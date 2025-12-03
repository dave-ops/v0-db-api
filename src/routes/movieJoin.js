// file: C:\_dev\repos\v0-db-api\src\routes\movieJoin.js
const express = require("express");
const clientPromise = require("../config/db");

const router = express.Router();

// Endpoint for movie card data (minimal data for grid view)
router.get("/movies-with-actors", async (req, res) => {
  try {
    const client = await clientPromise;
    const db = client.db("maga-movies");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: { "fullDetails.origin_country": "US" } },
      { $match: { poster_path: { $ne: null } } }, // Added filter for non-null poster_path
      { $match: { release_date: { $lt: new Date().toISOString().split('T')[0] } } },

      // Find the highest-billed female (first gender:1 in cast order)
      {
        $addFields: {
          leadFemaleCast: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$credits.cast",
                  as: "c",
                  cond: { $eq: ["$$c.gender", 1] }
                },
              },
              0
            ]
          }
        }
      },

      // If no female in cast → exclude (you can change to keep if you want)
      { $match: { leadFemaleCast: { $ne: null } } },

      // Extract her TMDB id
      {
        $addFields: {
          leadActressId: "$leadFemaleCast.id",
          leadActressName: "$leadFemaleCast.name"
        }
      },

      // Left-join ONLY this one actress from your custom actors collection
      {
        $lookup: {
          from: "actors",
          localField: "leadActressId",
          foreignField: "id",
          as: "leadActressDoc"
        }
      },
      { $unwind: { path: "$leadActressDoc", preserveNullAndEmptyArrays: true } },

      // FINAL FILTER — EXACTLY YOUR RULE
      // • Keep if: actress missing from DB (null) → user must fix
      // • Keep if: actress exists AND ethnicity = "caucasian"
      // • Remove if: actress exists AND ethnicity ≠ "caucasian"
      {
        $match: {
          $or: [
            // Case 1: Actress not in our DB → keep so user can add/fix
            { leadActressDoc: null },

            // Case 2: Actress exists and is caucasian → keep
            { "leadActressDoc.ethnicity": "caucasian" }
          ]
        }
      },

      // BONUS: Add helpful flags for frontend
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

      // Full cast enrichment (all actors that exist in your DB) - limited for card view
      {
        $lookup: {
          from: "actors",
          localField: "credits.cast.id",
          foreignField: "id",
          as: "matchingActors"
        }
      },

      // Project only the fields needed for movie card display
      {
        $project: {
          id: 1,
          title: 1,
          poster_path: 1,
          release_date: 1,
          vote_average: 1,
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

      { $sort: { release_date: -1 } },   // -1 = descending → newest first
      { $skip: skip },
      { $limit: limit }
    ];

    const results = await db.collection("movies").aggregate(pipeline).toArray();


    // Total count (same pipeline up to the strict $match)
    const totalDoc = await db.collection("movies").aggregate([
      ...pipeline.slice(0, pipeline.findIndex(s => s.$match && s.$match.$or) + 1),
      { $count: "total" }
    ]).toArray();

    const total = totalDoc[0]?.total || 0;

    res.json({
      results,
      total,
      page,
      total_pages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// New endpoint for detailed movie data (used in movie modal)
router.get("/movie-details/:id", async (req, res) => {
  try {
    const client = await clientPromise;
    const db = client.db("maga-movies");
    const movieId = parseInt(req.params.id);

    const pipeline = [
      { $match: { id: movieId } },
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
          backdrop_path: "$fullDetails.backdrop_path",
          overview: "$fullDetails.overview",
          genres: "$fullDetails.genres",
          runtime: "$fullDetails.runtime",
          tagline: "$fullDetails.tagline",
          credits: {
            cast: {
              $map: {
                input: "$credits.cast",
                as: "cast",
                in: {
                  id: "$$cast.id",
                  name: "$$cast.name",
                  character: "$$cast.character",
                  profile_path: "$$cast.profile_path",
                  order: "$$cast.order",
                  gender: "$$cast.gender"
                }
              }
            }
          },
          providers: { results: { US: "$providers.results.US" } },
          keywords: 1,
          matchingActors: {
            $map: {
              input: "$matchingActors",
              as: "a",
              in: {
                id: "$$a.id",
                name: "$$a.name",
                hairColor: "$$a.hairColor",
                heightRange: "$$a.heightRange",
                weightRange: "$$a.weightRange",
                ethnicity: "$$a.ethnicity",
                deleted: "$$a.deleted",
                hotScore: "$$a.hotScore"
              }
            }
          }
        }
      }
    ];

    const results = await db.collection("movies").aggregate(pipeline).toArray();

    if (results.length === 0) {
      return res.status(404).json({ error: "Movie not found" });
    }

    res.json(results[0]);
  } catch (error) {
    console.error("Error fetching movie details:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;