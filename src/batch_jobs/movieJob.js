// file: C:\_dev\repos\v0-db-api\src\batch_jobs\movieJob.js
const axios = require("axios");
const clientPromise = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const TMDB_API_KEY = "62ce064dcb3a1b5e0c8a8726f1b741dd";
const API_READ_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MmNlMDY0ZGNiM2ExYjVlMGM4YTg3MjZmMWI3NDFkZCIsIm5iZiI6MTc2NDg3MzQwOS4zODUsInN1YiI6IjY5MzFkNGMxM2IxY2I1ZDg0YzdmNTc2YiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.IimHoUjFu9YP8s-I_-Wp_QrZdNxOeBlGPqPJN0Ja350";

const TMDB_BASE_URL =
  process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const BATCH_SIZE = 20;
// Increase MAX_PAGES to fetch more movies, or set to a very high number to attempt fetching all
const MAX_PAGES = 25000; // Adjusted to fetch more pages
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"; // Base URL for movie poster and actor profile images
const IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || "./images"; // Base path for storing images

const ctr = {
  cur: 0,
  ttl: 0,
};

const today = new Date().toISOString().split("T")[0]; // e.g., "2025-12-04"
const minDate = "1969-01-01";

// Ensure the base image storage directory exists
if (!fs.existsSync(IMAGE_STORAGE_PATH)) {
  fs.mkdirSync(IMAGE_STORAGE_PATH, { recursive: true });
}

/*
curl --request GET \
     --url 'https://api.themoviedb.org/3/discover/movie?include_adult=true&include_video=true&language=en-US&page=1&primary_release_date.gte=1%2F1%2F1969&sort_by=primary_release_date.asc&with_origin_country=US&without_watch_providers=Hoopla%2CKanopy' \
     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MmNlMDY0ZGNiM2ExYjVlMGM4YTg3MjZmMWI3NDFkZCIsIm5iZiI6MTc2NDg3MzQwOS4zODUsInN1YiI6IjY5MzFkNGMxM2IxY2I1ZDg0YzdmNTc2YiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.IimHoUjFu9YP8s-I_-Wp_QrZdNxOeBlGPqPJN0Ja350' \
     --header 'accept: application/json'
*/

async function getMinReleaseDate(db) {
  const movieCollection = db.collection("movies");
  const count = await movieCollection.countDocuments();

  if (count === 0) {
    console.log("No movies in collection, using default minDate:", minDate);
    return minDate;
  }

  const latestMovie = await movieCollection.findOne(
    {},
    { sort: { release_date: -1 } }
  );
  if (latestMovie && latestMovie.release_date) {
    console.log(
      "Using max release_date from collection:",
      latestMovie.release_date
    );
    return latestMovie.release_date.split("T")[0]; // Format as YYYY-MM-DD
  }

  console.log("Fallback to minDate due to missing release_date:", minDate);
  return minDate;
}

async function fetchMovies(page) {
  ctr.cur++;
  const endpoint = `${TMDB_BASE_URL}/discover/movie`;
  console.log(`fetching page ${page} for ${endpoint}`);

  const client = await clientPromise;
  const db = client.db("maga-movies");
  const releaseDateGte = await getMinReleaseDate(db);

  const response = await axios.get(endpoint, {
    params: {
      api_key: TMDB_API_KEY,
      page,
      sort_by: "primary_release_date.asc",
      include_adult: true,
      with_origin_country: "US",
      "primary_release_date.gte": releaseDateGte,
      "primary_release_date.lte": today,
      language: "en-US",
      include_adult: true,
      include_video: true,
      // page_size fixed at 20
    },
  });
  console.log(response.data);
  console.log(`records found ${response.data.results.length}`);

  return response.data;
}

async function fetchMovieDetails(movieId) {
  throw new Error("not implemented");
  try {
    const [detailsRes, creditsRes, providersRes, keywordsRes] =
      await Promise.all([
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
    console.error(
      `Error fetching details for movie ${movieId}:`,
      error.message
    );
    return null;
  }
}

async function processMovies(movies) {
  const detailedMovies = [];
  for (const movie of movies) {
    const details = await fetchMovieDetails(movie.id);
    if (details) {
      detailedMovies.push({
        ...movie,
        fullDetails: details.details,
        credits: details.credits,
        providers: details.providers,
        keywords: details.keywords,
        lastUpdated: new Date(),
      });
    }
  }
  return detailedMovies;
}

async function processAndSaveImage(
  movieId,
  imagePath,
  imageType = "poster",
  id = null
) {
  ctr.cur++;

  if (!imagePath) return null;

  const originalUrl = `${IMAGE_BASE_URL}${imagePath}`;
  console.log(`${ctr.cur} processing ${imageType} ${originalUrl}`);

  const uuid = uuidv4();
  const firstChar = uuid.charAt(0);
  let folderPath;
  let newFileName;
  const fileExtension = ".webp"; // Using WebP for fastest loading
  const mid = movieId.toString();
  const firstTwo = mid.length >= 2 ? mid.substring(0, 2) : mid.padStart(2, "0");

  if (imageType === "poster") {
    folderPath = path.join(IMAGE_STORAGE_PATH, "posters", firstTwo);
    newFileName = `${movieId}${fileExtension}`;
  } else {
    // For actors, use the structure images/actors/<first 3 digits of actor_id>/<actor_id>
    const actorIdStr = id.toString();
    const firstThreeDigits =
      actorIdStr.length >= 3
        ? actorIdStr.substring(0, 3)
        : actorIdStr.padStart(3, "0");
    folderPath = path.join(IMAGE_STORAGE_PATH, "actors", firstThreeDigits);
    newFileName = `${id}${fileExtension}`;
  }

  const filePath = path.join(folderPath, newFileName);

  // Check if the image URL has already been processed
  const client = await clientPromise;
  const db = client.db("maga-movies");
  const imageCollection = db.collection("images");
  const existingImage = await imageCollection.findOne({ originalUrl });

  if (existingImage) {
    console.log(`Image already processed for ${originalUrl}, skipping.`);
    return {
      originalUrl,
      newFileName: existingImage.newFileName,
      path: existingImage.path,
      uuid: existingImage.uuid,
    };
  }

  // Create folder if it doesn't exist
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Fetch the image
  const response = await axios.get(originalUrl, {
    responseType: "arraybuffer",
  });
  const imageBuffer = Buffer.from(response.data, "binary");

  // Resize to 100px wide, maintain aspect ratio, and convert to WebP
  const resizedImageBuffer = await sharp(imageBuffer)
    .resize({ width: 100, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Save the image to the filesystem
  fs.writeFileSync(filePath, resizedImageBuffer);

  return {
    originalUrl,
    newFileName,
    path: filePath,
    uuid,
  };
}

async function saveToMongoDB(
  movies,
  dbName = "maga-movies",
  collName = "movies"
) {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const movieCollection = db.collection(collName);
    const imageCollection = db.collection("images");

    for (const movie of movies) {
      // Save movie data
      await movieCollection.updateOne(
        { id: movie.id },
        { $set: movie },
        { upsert: true }
      );

      // Process and save poster image if available
      if (movie.poster_path) {
        const imageData = await processAndSaveImage(
          movie.id,
          movie.poster_path,
          "poster"
        );
        if (imageData) {
          await imageCollection.updateOne(
            { originalUrl: imageData.originalUrl },
            {
              $set: {
                originalUrl: imageData.originalUrl,
                newFileName: imageData.newFileName,
                path: imageData.path,
                uuid: imageData.uuid,
                movieId: movie.id,
                lastUpdated: new Date(),
              },
            },
            { upsert: true }
          );
          console.log(
            `Saved image data for movie ${movie.id} to images collection`
          );
        }
      }

      // Process and save actor profile images if available
      if (
        movie.credits &&
        movie.credits.cast &&
        movie.credits.cast.length > 0
      ) {
        for (const actor of movie.credits.cast) {
          if (actor.profile_path) {
            const actorImageData = await processAndSaveImage(
              actor.profile_path,
              "actor",
              actor.id
            );
            if (actorImageData) {
              await imageCollection.updateOne(
                { originalUrl: actorImageData.originalUrl },
                {
                  $set: {
                    originalUrl: actorImageData.originalUrl,
                    newFileName: actorImageData.newFileName,
                    path: actorImageData.path,
                    uuid: actorImageData.uuid,
                    actorId: actor.id,
                    lastUpdated: new Date(),
                  },
                },
                { upsert: true }
              );
              console.log(
                `Saved image data for actor ${actor.id} to images collection`
              );
            }
          }
        }
      }
    }
    console.log(`Saved ${movies.length} movies to MongoDB`);
  } catch (error) {
    console.error("Error saving to MongoDB:", error.message);
  }
}

async function batchJob() {
  console.log("Starting batch job to pre-compile movie data...");
  let currentPage = 1;
  let totalPages = 1;

  while (currentPage <= totalPages && currentPage <= MAX_PAGES) {
    console.log(`Fetching page ${currentPage} of ${totalPages}...`);
    const data = await fetchMovies(currentPage);
    totalPages = Math.min(data.total_pages, MAX_PAGES);

    if (data.results.length > 0) {
      const moviesToProcess = data.results.slice(0, BATCH_SIZE);
      console.log(
        `Processing ${moviesToProcess.length} movies from page ${currentPage}...`
      );
      //const detailedMovies = await processMovies(moviesToProcess);
      await saveToMongoDB(moviesToProcess);
    } else {
      console.log(`No more movies found on page ${currentPage}. Stopping.`);
      break; // Exit loop if no results are found on the current page
    }

    currentPage++;
  }

  console.log("Batch job completed.");
  process.exit(0);
}

batchJob().catch((err) => {
  console.error("Batch job failed:", err);
  process.exit(1);
});
