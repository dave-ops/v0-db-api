// file: C:\_dev\repos\v0-db-api\src\routes\imageProxy.js
const express = require("express");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const router = express.Router();

// Directory to store cached images
const CACHE_DIR = path.join(__dirname, "../../image_cache");
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error("Error creating cache directory:", error.message);
  }
}
ensureCacheDir();

// Proxy route for images
router.get("/image/:size/:path", async (req, res) => {
  const { size, path } = req.params;
  const imagePath = path.split(".")[0]; // Remove extension if any
  const cacheFilePath = path.join(CACHE_DIR, size, `${imagePath}.jpg`);

  try {
    // Check if image exists in cache
    try {
      await fs.access(cacheFilePath);
      console.log(`Serving cached image: ${cacheFilePath}`);
      return res.sendFile(cacheFilePath);
    } catch {
      // Image not in cache, fetch from TMDB
      console.log(`Image not in cache, fetching: ${size}/${path}`);
      const imageUrl = `${TMDB_IMAGE_BASE}/${size}/${path}`;
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });

      // Ensure the size directory exists
      await fs.mkdir(path.join(CACHE_DIR, size), { recursive: true });

      // Save to cache
      await fs.writeFile(cacheFilePath, response.data);
      console.log(`Saved image to cache: ${cacheFilePath}`);

      // Send the image
      res.setHeader("Content-Type", "image/jpeg");
      return res.send(response.data);
    }
  } catch (error) {
    console.error("Error handling image request:", error.message);
    return res.status(500).json({ error: "Failed to fetch or serve image" });
  }
});

module.exports = router;