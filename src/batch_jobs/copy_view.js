// file: C:\_dev\repos\v0-db-api\src\batch_jobs\moviesDetailsJob.js
const clientPromise = require("../config/db");
require("dotenv").config();

async function saveToMongoDB(movies, dbName = "maga-movies", collName = "movies_with_details") {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(collName);

    // Clear existing data to avoid duplicates
    await collection.deleteMany({});
    console.log("Existing data in movies_with_details cleared.");

    // remove movies without providers
    const valid = movies.find((f) => f.providers.results.length > 0);
    console.log(`- valid providers: ${valid.length}`);

    // Insert all movies from the view
    if (movies.length > 0) {
      const result = await collection.insertMany(movies);
      console.log(`Inserted ${result.insertedCount} movies into ${collName} collection.`);
    } else {
      console.log("No movies to insert into movies_with_details.");
    }
  } catch (error) {
    console.error("Error saving to MongoDB:", error.message);
  }
}

async function fetchMoviesFromView(dbName = "maga-movies", viewName = "movies_with_lead_caucasian_actress") {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const view = db.collection(viewName);

    // Fetch all records from the view
    const movies = await view.find({}).toArray();
    console.log(`Fetched ${movies.length} movies from ${viewName} view.`);
    return movies;
  } catch (error) {
    console.error(`Error fetching movies from ${viewName} view:`, error.message);
    return [];
  }
}

async function batchJob() {
  console.log("Starting batch job to populate movies_with_details collection...");

  // Fetch movies from the view
  const movies = await fetchMoviesFromView();

  // Save the movies to the new collection
  await saveToMongoDB(movies);

  console.log("Batch job completed.");
  process.exit(0);
}

batchJob().catch((err) => {
  console.error("Batch job failed:", err);
  process.exit(1);
});