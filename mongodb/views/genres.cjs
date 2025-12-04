// file: C:\_dev\repos\v0-db-api\mongodb\views\genres.cjs
const clientPromise = require("../../src/config/db");

(async () => {
  let client;
  try {
    client = await clientPromise;
    const db = client.db("maga-movies");

    // Drop the existing view if it exists
    try {
      await db.collection("genres").drop();
      console.log("Existing view dropped.");
    } catch (err) {
      console.log("No existing view to drop, proceeding to create a new one.");
    }

    // Create the view using an aggregation pipeline
    await db.createCollection("genres", {
      viewOn: "movies",
      pipeline: [
        // Unwind the genres array to create a document for each genre
        { $unwind: "$fullDetails.genres" },
        // Group by genre id to get unique genres
        {
          $group: {
            _id: "$fullDetails.genres.id",
            name: { $first: "$fullDetails.genres.name" }
          }
        },
        // Project to reshape the output
        {
          $project: {
            id: "$_id",
            name: 1,
            _id: 0
          }
        },
        // Sort by id
        { $sort: { id: 1 } }
      ]
    });
    console.log("View 'genres' created successfully.");
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