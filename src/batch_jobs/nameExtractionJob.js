// file: C:\_dev\repos\v0-db-api\src\batch_jobs\nameExtractionJob.js
const clientPromise = require("../config/db");
require("dotenv").config();

async function extractNamesFromMovies(dbName = "maga-movies", moviesCollName = "movies", namesCollName = "names") {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const moviesCollection = db.collection(moviesCollName);
    const namesCollection = db.collection(namesCollName);

    // Clear existing data in names collection to avoid duplicates
    await namesCollection.deleteMany({});
    console.log("Cleared existing data in names collection.");

    // Step 1: Unwind credits.cast and origin_country, and group by country, name
    const uniqueNamesByCountry = await moviesCollection
      .aggregate([
        { $unwind: "$credits.cast" },
        // Filter to include only cast members with a profile photo
        { $match: { "credits.cast.profile_path": { $ne: null } } },
        { $unwind: "$fullDetails.origin_country" },
        {
          $group: {
            _id: {
              country: "$fullDetails.origin_country",
              name: "$credits.cast.name"
            },
            country: { $first: "$fullDetails.origin_country" },
            name: { $first: "$credits.cast.name" }
          }
        },
        { $sort: { "_id.country": 1, "_id.name": 1 } },
        {
          $project: {
            country: 1,
            name: 1,
            _id: 0
          }
        }
      ])
      .toArray();

    console.log(`Found ${uniqueNamesByCountry.length} unique name-country combinations from movies collection.`);

    // Step 2: Split names into first and last, and prepare data
    const nameObjects = uniqueNamesByCountry
      .map(item => {
        const name = item.name.trim();
        const nameParts = name.split(" ");
        if (nameParts.length < 2) return null; // Skip names without at least first and last
        const first = nameParts[0];
        const last = nameParts[nameParts.length - 1];
        return {
          country: item.country,
          first: first,
          last: last,
          original: name
        };
      })
      .filter(item => item !== null);

    // Step 3: Group by country and first name to collect last names with actor details
    const groupedByCountryAndFirstName = await moviesCollection
      .aggregate([
        { $unwind: "$credits.cast" },
        // Filter to include only cast members with a profile photo
        { $match: { "credits.cast.profile_path": { $ne: null } } },
        { $unwind: "$fullDetails.origin_country" },
        {
          $project: {
            country: "$fullDetails.origin_country",
            name: "$credits.cast.name",
            actor_id: "$credits.cast.id",
            profile_path: "$credits.cast.profile_path"
          }
        },
        {
          $group: {
            _id: {
              country: "$country",
              name: "$name"
            },
            country: { $first: "$country" },
            name: { $first: "$name" },
            actor_id: { $first: "$actor_id" },
            profile_path: { $first: "$profile_path" }
          }
        },
        {
          $project: {
            country: 1,
            name: 1,
            actor_id: 1,
            profile_path: 1,
            _id: 0
          }
        },
        {
          $group: {
            _id: {
              country: "$country",
              firstName: {
                $arrayElemAt: [{ $split: ["$name", " "] }, 0]
              }
            },
            country: { $first: "$country" },
            firstName: {
              $first: {
                $arrayElemAt: [{ $split: ["$name", " "] }, 0]
              }
            },
            lastNames: {
              $addToSet: {
                name: {
                  $arrayElemAt: [
                    { $split: ["$name", " "] },
                    { $subtract: [{ $size: { $split: ["$name", " "] } }, 1] }
                  ]
                },
                actors: {
                  $cond: {
                    if: { $and: [{ $ne: ["$actor_id", null] }, { $ne: ["$profile_path", null] }] },
                    then: [{ id: "$actor_id", profile_path: "$profile_path" }],
                    else: []
                  }
                }
              }
            }
          }
        },
        {
          $project: {
            id: { $concat: ["$_id.country", "-", "$_id.firstName"] },
            origin_country: "$country",
            first_name: "$firstName",
            last_names: "$lastNames",
            _id: 0
          }
        },
        { $sort: { origin_country: 1, first_name: 1 } }
      ])
      .toArray();

    console.log(`Processed ${groupedByCountryAndFirstName.length} unique country-first name combinations.`);

    // Step 4: Insert the grouped data into the names collection
    if (groupedByCountryAndFirstName.length > 0) {
      await namesCollection.insertMany(groupedByCountryAndFirstName);
      console.log(`Inserted ${groupedByCountryAndFirstName.length} records into names collection.`);
    } else {
      console.log("No records to insert into names collection.");
    }

    console.log("Completed name extraction and insertion process.");
    return groupedByCountryAndFirstName.length;
  } catch (error) {
    console.error(`Error during name extraction: ${error.message}`);
    throw error;
  }
}

async function batchJob() {
  console.log("Starting batch job for name extraction with country...");

  try {
    const processedCount = await extractNamesFromMovies();
    console.log(`Batch job completed. Processed ${processedCount} distinct country-first name combinations.`);
    process.exit(0);
  } catch (err) {
    console.error(`Batch job failed: ${err.message}`);
    process.exit(1);
  }
}

batchJob().catch((err) => {
  console.error("Batch job failed:", err);
  process.exit(1);
});