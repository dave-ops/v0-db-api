// file: C:\_dev\repos\v0-db-api\src\routes\providerRoutes.js
const express = require('express');
const puppeteer = require('puppeteer');
const clientPromise = require('../config/db');

const router = express.Router();

const getDbCollection = async (dbName, collName) => {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db.collection(collName);
};

// Function to scrape provider URLs from TMDB
const scrapeProviderUrls = async (movieId, locale) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://www.themoviedb.org/movie/${movieId}/watch?locale=${locale}`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Extract provider URLs from the page
    const providerData = await page.evaluate(() => {
      const providers = [];
      const elements = document.querySelectorAll('.ott_provider');

      elements.forEach(el => {
        const providerName = el.querySelector('.ott_provider_name')?.textContent.trim();
        const providerUrl = el.querySelector('a')?.href;

        if (providerName && providerUrl) {
          providers.push({
            name: providerName.toLowerCase(),
            url: providerUrl
          });
        }
      });

      return providers;
    });

    return providerData;
  } catch (error) {
    console.error(`Error scraping provider URLs for movie ${movieId}:`, error.message);
    throw error;
  } finally {
    await browser.close();
  }
};

// Endpoint to get provider URL for a specific movie and provider
router.post('/providers/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const { providerName, locale = 'US' } = req.body;

    if (!providerName) {
      return res.status(400).json({ error: 'Provider name is required' });
    }

    const normalizedProviderName = providerName.toLowerCase();
    const coll = await getDbCollection('maga-movies', 'providers');

    // Check if we already have provider data for this movie
    const existingData = await coll.findOne({ movieId: parseInt(movieId) });

    if (existingData && existingData.providers && existingData.providers[locale]) {
      const provider = existingData.providers[locale].find(p => p.name === normalizedProviderName);
      if (provider) {
        return res.json({ url: provider.url });
      }
    }

    // If not found or no data, scrape the URLs
    const providerData = await scrapeProviderUrls(movieId, locale);

    // Store the scraped data in MongoDB
    await coll.updateOne(
      { movieId: parseInt(movieId) },
      {
        $set: {
          movieId: parseInt(movieId),
          providers: {
            [locale]: providerData
          },
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );

    // Find the requested provider
    const provider = providerData.find(p => p.name === normalizedProviderName);

    if (provider) {
      res.json({ url: provider.url });
    } else {
      res.status(404).json({ error: `Provider ${providerName} not found for movie ${movieId} in locale ${locale}` });
    }
  } catch (error) {
    console.error('Error in provider route:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get all providers for a movie
router.get('/providers/:movieId', async (req, res) => {
  try {
    const { movieId } = req.params;
    const { locale = 'US' } = req.query;

    const coll = await getDbCollection('maga-movies', 'providers');
    const existingData = await coll.findOne({ movieId: parseInt(movieId) });

    if (existingData && existingData.providers && existingData.providers[locale]) {
      return res.json({ providers: existingData.providers[locale] });
    }

    // If not found, scrape the data
    const providerData = await scrapeProviderUrls(movieId, locale);

    // Store in MongoDB
    await coll.updateOne(
      { movieId: parseInt(movieId) },
      {
        $set: {
          movieId: parseInt(movieId),
          providers: {
            [locale]: providerData
          },
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );

    res.json({ providers: providerData });
  } catch (error) {
    console.error('Error fetching all providers:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;