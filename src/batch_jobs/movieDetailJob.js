// file: C:\_dev\repos\v0-db-api\src\batch_jobs\movieDetailJob.js
const axios = require("axios");
const clientPromise = require("../config/db");
require("dotenv").config();

const TMDB_API_KEY = "62ce064dcb3a1b5e0c8a8726f1b741dd";
const TMDB_BASE_URL = process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const BATCH_SIZE = 2; // Further reduced batch size to minimize memory usage
const PAGE_SIZE = 100; // Number of records to fetch per page

async function fetchMovieDetails(movieId) {
  try {
    const [detailsRes, creditsRes, providersRes, keywordsRes, releaseDatesRes] = await Promise.all([
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
      axios.get(`${TMDB_BASE_URL}/movie/${movieId}/release_dates`, {
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
      release_dates: releaseDatesRes.data, // Store the entire release_dates object
    };
  } catch (error) {
    console.error(`Error fetching details for movie ${movieId}:`, error.message);
    return null;
  }
}

async function getMoviesMissingDetails(dbName = "maga-movies", collName = "movies", page = 1, pageSize = PAGE_SIZE) {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(collName);

    // Calculate the number of documents to skip based on the current page
    const skip = (page - 1) * pageSize;

    // Find movies missing fullDetails, credits, providers, keywords, or release_dates
    const movies = await collection.find({
      $or: [
        { fullDetails: { $exists: false } },
        //{ credits: { $exists: false } },
        { providers: { $exists: false } },
        { keywords: { $exists: false } },
        { release: { $exists: false } },
        { updated_utc: { $exists: false } },
      ],
    })
    .skip(skip)
    .limit(pageSize)
    .toArray();

    console.log(`Found ${movies.length} movies missing detailed data on page ${page}.`);
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
      release_dates: details.release_dates, // Store the entire release_dates object
      updated_utc: new Date().toISOString(),
    };

    console.log("\n# result")
    console.log(JSON.stringify(updateData, null, 4));

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

async function processBatch(batch, totalProcessed, totalMovies) {
  for (const movie of batch) {
    console.log(`Processing movie ID ${movie.id} - ${movie.title || 'Unknown Title'} (${totalProcessed + 1}/${totalMovies})...`);
    const details = await fetchMovieDetails(movie.id);
    if (details) {
      await updateMovieDetails(movie.id, details);
    } else {
      console.log(`Skipping movie ID ${movie.id} due to fetch error.`);
    }
    totalProcessed++;
    // Log memory usage after each movie
    const memoryUsage = process.memoryUsage();
    console.log(`Memory usage after movie ${totalProcessed}: RSS=${Math.round(memoryUsage.rss / 1024 / 1024)}MB, HeapTotal=${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB, HeapUsed=${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`);
    // Force garbage collection after each movie if possible
    global.gc && global.gc();
  }
  return totalProcessed;
}

async function batchJob() {
  console.log("Starting batch job to update movie details...");

  try {
    const client = await clientPromise;
    const db = client.db("maga-movies");
    const collection = db.collection("movies");

    // Get total count of movies missing details to estimate pages
    const totalMissing = await collection.countDocuments({
      $or: [
        { fullDetails: { $exists: false } },
        { credits: { $exists: false } },
        { providers: { $exists: false } },
        { keywords: { $exists: false } },
        { release_dates: { $exists: false } },
      ],
    });

    if (totalMissing === 0) {
      console.log("No movies found missing details. Exiting.");
      process.exit(0);
    }

    console.log(`Total movies missing details: ${totalMissing}`);
    const totalPages = Math.ceil(totalMissing / PAGE_SIZE);
    console.log(`Processing ${totalMissing} movies in pages of ${PAGE_SIZE} across ${totalPages} pages...`);

    let totalProcessed = 0;

    // Process movies page by page
    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      console.log(`Fetching page ${currentPage} of ${totalPages}...`);
      const movies = await getMoviesMissingDetails("maga-movies", "movies", currentPage, PAGE_SIZE);

      if (movies.length === 0) {
        console.log(`No more movies found on page ${currentPage}. Stopping.`);
        break;
      }

      // Process movies in smaller batches within the page
      for (let i = 0; i < movies.length; i += BATCH_SIZE) {
        const batch = movies.slice(i, i + BATCH_SIZE);
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} on page ${currentPage}...`);
        totalProcessed = await processBatch(batch, totalProcessed, totalMissing);
        // Clear memory after each batch
        global.gc && global.gc();
        console.log(`Cleared memory after batch ${Math.floor(i / BATCH_SIZE) + 1} on page ${currentPage}`);
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
