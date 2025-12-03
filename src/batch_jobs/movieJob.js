// file: C:\_dev\repos\v0-db-api\src\batch_jobs\movieJob.js
const axios = require("axios");
const clientPromise = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const TMDB_API_KEY =
  process.env.TMDB_API_KEY || "2dca580c2a14b55200e784d157207b4d";
const TMDB_BASE_URL =
  process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
// Increase MAX_PAGES to fetch more movies, or set to a very high number to attempt fetching all
const MAX_PAGES = parseInt(process.env.MAX_PAGES) || 1000; // Adjusted to fetch more pages
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"; // Base URL for movie poster images
const IMAGE_STORAGE_PATH = process.env.IMAGE_STORAGE_PATH || "./images"; // Base path for storing images

const ctr = {
  cur: 0,
  ttl: 0,
};

// Ensure the base image storage directory exists
if (!fs.existsSync(IMAGE_STORAGE_PATH)) {
  fs.mkdirSync(IMAGE_STORAGE_PATH, { recursive: true });
}

async function fetchMovies(page) {
  try {
    const response = await axios.get(`${TMDB_BASE_URL}/discover/movie`, {
      params: {
        api_key: TMDB_API_KEY,
        page,
        sort_by: "popularity.desc",
        include_adult: true,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching movies for page ${page}:`, error.message);
    return { results: [], total_pages: 0 };
  }
}

async function fetchMovieDetails(movieId) {
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

async function processAndSaveImage(posterPath) {
  ctr.cur++;

  if (!posterPath) return null;

  const originalUrl = `${IMAGE_BASE_URL}${posterPath}`;
  console.log(`${ctr.cur} processing ${originalUrl}`);

  const uuid = uuidv4();
  const firstChar = uuid.charAt(0);
  const folderPath = path.join(IMAGE_STORAGE_PATH, firstChar);
  const fileExtension = ".webp"; // Using WebP for fastest loading
  const newFileName = `${uuid}${fileExtension}`;
  const filePath = path.join(folderPath, newFileName);

  try {
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
  } catch (error) {
    console.error(`Error processing image for ${originalUrl}:`, error.message);
    return null;
  }
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
        const imageData = await processAndSaveImage(movie.poster_path);
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
      const detailedMovies = await processMovies(moviesToProcess);
      await saveToMongoDB(detailedMovies);
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
