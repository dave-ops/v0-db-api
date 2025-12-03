// file: C:\_dev\repos\v0-db-api\src\routes\countryRoutes.js
const express = require("express");
const clientPromise = require("../config/db");

const router = express.Router();

router.get("/countries", async (req, res) => {
  try {
    const client = await clientPromise;
    const db = client.db("maga-movies");

    const pipeline = [
      { $unwind: "$fullDetails.origin_country" },
      {
        $group: {
          _id: null,
          distinctCountries: {
            $addToSet: "$fullDetails.origin_country"
          }
        }
      },
      { $project: { _id: 0, distinctCountries: 1 } }
    ];

    const results = await db.collection("movies").aggregate(pipeline, { maxTimeMS: 60000, allowDiskUse: true }).toArray();

    if (results.length > 0) {
      res.json({
        countries: results[0].distinctCountries || []
      });
    } else {
      res.json({
        countries: []
      });
    }
  } catch (error) {
    console.error("Error fetching distinct countries:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;