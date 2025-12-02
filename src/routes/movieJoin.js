// src/routes/movieJoin.js
const express = require("express");
const clientPromise = require("../config/db");

const router = express.Router();

router.get("/movies-with-actors", async (req, res) => {
  try {
    const client = await clientPromise;
    const db = client.db("maga-movies");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const pipeline = [
      { $match: { "fullDetails.origin_country": "US" } },

      // Step 1: Find the lead actress (order: 0 in cast)
      {
        $addFields: {
          leadActressId: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$credits.cast",
                  as: "c",
                  cond: { $eq: ["$$c.order", 0] }
                }
              },
              0
            ]
          }
        }
      },
      { $addFields: { leadActressId: "$leadActressId.id" } },

      // Step 2: Join only the lead actress from actors collection
      {
        $lookup: {
          from: "actors",
          localField: "leadActressId",
          foreignField: "id",
          as: "leadActressDoc"
        }
      },

      // Step 3: KEEP ONLY movies that satisfy ONE of your two rules
      {
        $match: {
          $or: [
            // Rule 1: Lead actress exists AND is caucasian
            {
              "leadActressDoc.0.ethnicity": "caucasian"
            },
            // Rule 2: No lead actress in our actors table (array empty)
            {
              "leadActressDoc": { $eq: [] }
            }
          ]
        }
      },

      // Step 4: Full actors lookup for display (optional but you want it)
      {
        $lookup: {
          from: "actors",
          localField: "credits.cast.id",
          foreignField: "id",
          as: "matchingActors"
        }
      },

      // Final projection
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
                  order: "$$cast.order"
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
      },

      { $skip: skip },
      { $limit: limit }
    ];

    const results = await db.collection("movies").aggregate(pipeline).toArray();

    // Accurate total count
    const totalDoc = await db.collection("movies").aggregate([
      ...pipeline.slice(0, 5), // up to and including the strict $match
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

module.exports = router;