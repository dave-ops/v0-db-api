// file: C:\_dev\repos\v0-db-api\src\middleware\banCheck.js
const clientPromise = require("../config/db");

const getDbCollection = async (dbName, collName) => {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db.collection(collName);
};

const banCheck = async (req, res, next) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const walletAddress = req.headers.authorization?.split(' ')[1] || null;

    const coll = await getDbCollection("maga-movies", "bannedEntities");
    const banQuery = {
      $or: [
        { type: "ip", value: clientIp },
        ...(walletAddress ? [{ type: "wallet", value: walletAddress }] : [])
      ]
    };

    const bannedEntity = await coll.findOne(banQuery);

    if (bannedEntity) {
      return res.status(403).json({ error: `Access denied: ${bannedEntity.type} is banned` });
    }

    next();
  } catch (error) {
    console.error("Error in banCheck middleware:", error.message);
    res.status(500).json({ error: "Internal server error during ban check" });
  }
};

module.exports = banCheck;