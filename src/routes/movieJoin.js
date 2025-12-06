// file: C:\_dev\repos\v0-db-api\src\routes\movieJoin.js
const express = require("express");
const clientPromise = require("../config/db");

const router = express.Router();

// Endpoint for movie card data (minimal data for grid view)
router.get("/movies-with-actors", async (req, res) => {
  try {
    const client = await clientPromise;
    const db = client.db("maga-movies");
    const collection = db.collection("movies_with_details");

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Super clean! Just like querying a normal collection
    const results = await collection.find({}).skip(skip).limit(limit).toArray();

    const total = await collection.countDocuments({});

    res.json({
      results,
      total,
      page,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;