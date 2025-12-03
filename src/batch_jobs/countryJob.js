// file: C:\_dev\repos\v0-db-api\src\batch_jobs\countryJob.js
const clientPromise = require("../config/db");
require("dotenv").config();

// List of country codes and names
const countryCodes = [
    { code: "AL", name: "Albania" },
    { code: "RO", name: "Romania" },
    { code: "SU", name: "Soviet Union (historical)" },
    { code: "XG", name: "East Germany (historical)" },
    { code: "JO", name: "Jordan" },
    { code: "NL", name: "Netherlands" },
    { code: "MQ", name: "Martinique" },
    { code: "AU", name: "Australia" },
    { code: "MX", name: "Mexico" },
    { code: "CH", name: "Switzerland" },
    { code: "NP", name: "Nepal" },
    { code: "BO", name: "Bolivia" },
    { code: "IR", name: "Iran" },
    { code: "GR", name: "Greece" },
    { code: "PA", name: "Panama" },
    { code: "KN", name: "Saint Kitts and Nevis" },
    { code: "KW", name: "Kuwait" },
    { code: "BR", name: "Brazil" },
    { code: "PL", name: "Poland" },
    { code: "RS", name: "Serbia" },
    { code: "UA", name: "Ukraine" },
    { code: "LK", name: "Sri Lanka" },
    { code: "GP", name: "Guadeloupe" },
    { code: "ME", name: "Montenegro" },
    { code: "LB", name: "Lebanon" },
    { code: "LI", name: "Liechtenstein" },
    { code: "CF", name: "Central African Republic" },
    { code: "PR", name: "Puerto Rico" },
    { code: "EC", name: "Ecuador" },
    { code: "DK", name: "Denmark" },
    { code: "PK", name: "Pakistan" },
    { code: "SA", name: "Saudi Arabia" },
    { code: "CO", name: "Colombia" },
    { code: "BG", name: "Bulgaria" },
    { code: "US", name: "United States" },
    { code: "IT", name: "Italy" },
    { code: "TR", name: "Turkey" },
    { code: "NZ", name: "New Zealand" },
    { code: "LT", name: "Lithuania" },
    { code: "RU", name: "Russia" },
    { code: "ZA", name: "South Africa" },
    { code: "MT", name: "Malta" },
    { code: "CY", name: "Cyprus" },
    { code: "ID", name: "Indonesia" },
    { code: "LV", name: "Latvia" },
    { code: "DE", name: "Germany" },
    { code: "CZ", name: "Czech Republic" },
    { code: "BM", name: "Bermuda" },
    { code: "SI", name: "Slovenia" },
    { code: "IN", name: "India" },
    { code: "SE", name: "Sweden" },
    { code: "RE", name: "Réunion" },
    { code: "UY", name: "Uruguay" },
    { code: "GB", name: "United Kingdom" },
    { code: "SG", name: "Singapore" },
    { code: "HN", name: "Honduras" },
    { code: "QA", name: "Qatar" },
    { code: "HR", name: "Croatia" },
    { code: "AR", name: "Argentina" },
    { code: "PY", name: "Paraguay" },
    { code: "LU", name: "Luxembourg" },
    { code: "AW", name: "Aruba" },
    { code: "NG", name: "Nigeria" },
    { code: "NE", name: "Niger" },
    { code: "HK", name: "Hong Kong" },
    { code: "FI", name: "Finland" },
    { code: "FR", name: "France" },
    { code: "NO", name: "Norway" },
    { code: "ES", name: "Spain" },
    { code: "PH", name: "Philippines" },
    { code: "DO", name: "Dominican Republic" },
    { code: "HU", name: "Hungary" },
    { code: "XC", name: "Czechoslovakia (historical)" },
    { code: "CL", name: "Chile" },
    { code: "JP", name: "Japan" },
    { code: "BW", name: "Botswana" },
    { code: "MY", name: "Malaysia" },
    { code: "CN", name: "China" },
    { code: "AT", name: "Austria" },
    { code: "BA", name: "Bosnia and Herzegovina" },
    { code: "KZ", name: "Kazakhstan" },
    { code: "PS", name: "Palestine" },
    { code: "MA", name: "Morocco" },
    { code: "TH", name: "Thailand" },
    { code: "IE", name: "Ireland" },
    { code: "YU", name: "Yugoslavia (historical)" },
    { code: "UR", name: "Uruguay" },
    { code: "EG", name: "Egypt" },
    { code: "TW", name: "Taiwan" },
    { code: "EE", name: "Estonia" },
    { code: "VE", name: "Venezuela" },
    { code: "IS", name: "Iceland" },
    { code: "HT", name: "Haiti" },
    { code: "CA", name: "Canada" },
    { code: "DZ", name: "Algeria" },
    { code: "BE", name: "Belgium" },
    { code: "CD", name: "Democratic Republic of the Congo" },
    { code: "MR", name: "Mauritania" },
    { code: "MN", name: "Mongolia" },
    { code: "PE", name: "Peru" },
    { code: "TN", name: "Tunisia" },
    { code: "VN", name: "Vietnam" },
    { code: "SK", name: "Slovakia" },
    { code: "CI", name: "Côte d'Ivoire" },
    { code: "IL", name: "Israel" },
    { code: "AE", name: "United Arab Emirates" },
    { code: "BY", name: "Belarus" },
    { code: "ET", name: "Ethiopia" },
    { code: "KR", name: "South Korea" },
    { code: "LY", name: "Libya" },
    { code: "GH", name: "Ghana" },
    { code: "PT", name: "Portugal" }
];

async function saveToMongoDB(countries, dbName = "maga-movies", collName = "countries") {
  try {
    const client = await clientPromise;
    const db = client.db(dbName);
    const collection = db.collection(collName);

    // Clear existing data to avoid duplicates
    await collection.deleteMany({});

    // Insert all countries
    const result = await collection.insertMany(countries);
    console.log(`Inserted ${result.insertedCount} countries into MongoDB`);
  } catch (error) {
    console.error("Error saving to MongoDB:", error.message);
  }
}

async function batchJob() {
  console.log("Starting batch job to populate country data...");

  // Save the country codes to MongoDB
  await saveToMongoDB(countryCodes);

  console.log("Batch job completed.");
  process.exit(0);
}

batchJob().catch((err) => {
  console.error("Batch job failed:", err);
  process.exit(1);
});