// file: C:\_dev\repos\v0-db-api\src\batch_jobs\movieDetailJob.js
const axios = require("axios");
const clientPromise = require("../config/db");
require("dotenv").config();

const TMDB_API_KEY = "62ce064dcb3a1b5e0c8a8726f1b741dd";
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";

async function fetchMovieDetails(movieId) {
  try {
    const [detailsRes, creditsRes, providersRes, keywordsRes] = await Promise.all([
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
        params: { api_key: TMDB_API_KEY },
      }),
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}/credits`, {
        params: { api_key: TMDB_API_KEY },
      }),
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}/watch/providers`, {
        params: { api_key: TMDB_API_KEY },
      }),
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}/keywords`, {
        params: { api_key: TMDB_API_KEY },
      }),
    ]);

    // Filter out providers named 'Hoopla' and 'Kanopy'
    if (providersRes.data.results && providersRes.data.results.US) {
      const usProviders = providersRes.data.results.US;
      for (const providerType in usProviders) {
        if (Array.isArray(usProviders[providerType])) {
          usProviders[providerType] = usProviders[providerType].filter(
            (provider) => !["Hoopla", "Kanopy"].includes(provider.provider_name)
          );
        }
      }
    }

    return {
      details: detailsRes.data,
      credits: creditsRes.data,
      providers: providersRes.data,
      keywords: keywordsRes.data.keywords,
    };
  } catch (error) {
    console.error(`Error fetching details for movie ${movieId}:`, error.message);
    return null;
  }
}

async function getMoviesMissingDetails(dbName = "maga-movies", collName = "movies") {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(collName);

    // Find movies missing fullDetails, credits, providers, or keywords
    const movies = await collection.find({
      $or: [
        { fullDetails: { $exists: false } },
        { credits: { $exists: false } },
        { providers: { $exists: false } },
        { keywords: { $exists: false } },
      ],
    }).toArray();

    console.log(`Found ${movies.length} movies missing detailed data.`);
    return movies;
  } catch (error) {
    console.error("Error fetching movies missing details:", error.message);
    return [];
  }
}

async function updateMovieDetails(movieId, details, dbName = "maga-movies", collName = "movies") {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(collName);

    const updateData = {
      fullDetails: details.details,
      credits: details.credits,
      providers: details.providers,
      keywords: details.keywords,
      updated_utc: new Date().toISOString(),
    };

    const result = await collection.updateOne(
      { id: movieId },
      { $set: updateData }
    );

    console.log(`Updated movie ID ${movieId} with new details.`);
    return result;
  } catch (error) {
    console.error(`Error updating movie ID ${movieId}:`, error.message);
    return null;
  }
}

async function batchJob() {
  console.log("Starting batch job to update movie details...");

  try {
    const client = await clientPromise;
    const movies = await getMoviesMissingDetails();

    if (movies.length === 0) {
      console.log("No movies found missing details. Exiting.");
      process.exit(0);
    }

    for (const movie of movies) {
      console.log(`Processing movie ID ${movie.id} - ${movie.title || 'Unknown Title'}...`);
      const details = await fetchMovieDetails(movie.id);
      if (details) {
        await updateMovieDetails(movie.id, details);
      } else {
        console.log(`Skipping movie ID ${movie.id} due to fetch error.`);
      }
    }

    console.log("Batch job completed. All movies processed.");
  } catch (err) {
    console.error("Batch job failed:", err);
  } finally {
    process.exit(0);
  }
}

batchJob().catch((err) => {
  console.error("Batch job failed:", err);
  process.exit(1);
});