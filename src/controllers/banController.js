// file: C:\_dev\repos\v0-db-api\src\controllers\banController.js
const clientPromise = require("../config/db");

const getDbCollection = async (dbName, collName) => {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db.collection(collName);
};

// Check if the user is an admin
const checkAdmin = async (walletAddress) => {
  const coll = await getDbCollection("maga-movies", "users");
  const user = await coll.findOne({ id: walletAddress });
  return user && user.is_admin;
};

// Ban an IP or wallet address
const banEntity = async (req, res) => {
  try {
    const { database, collection } = req.params;
    const { type, value, reason } = req.body;
    const walletAddress = req.headers.authorization?.split(' ')[1] || null;

    if (!walletAddress) {
      return res.status(401).json({ error: "No wallet address provided" });
    }

    if (!(await checkAdmin(walletAddress))) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    if (!type || !value) {
      return res.status(400).json({ error: "Type and value are required" });
    }

    if (!["ip", "wallet"].includes(type)) {
      return res.status(400).json({ error: "Invalid ban type. Use 'ip' or 'wallet'" });
    }

    const coll = await getDbCollection(database, collection);
    const banData = {
      type,
      value,
      reason: reason || "No reason provided",
      bannedAt: new Date(),
      bannedBy: walletAddress
    };

    const result = await coll.insertOne(banData);
    res.status(201).json({ insertedId: result.insertedId, ...banData });
  } catch (err) {
    console.error("Error in banEntity:", err);
    res.status(500).json({ error: err.message });
  }
};

// Unban an IP or wallet address
const unbanEntity = async (req, res) => {
  try {
    const { database, collection, id } = req.params;
    const walletAddress = req.headers.authorization?.split(' ')[1] || null;

    if (!walletAddress) {
      return res.status(401).json({ error: "No wallet address provided" });
    }

    if (!(await checkAdmin(walletAddress))) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Ban not found" });
    }

    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Error in unbanEntity:", err);
    res.status(500).json({ error: err.message });
  }
};

// List all banned entities
const listBannedEntities = async (req, res) => {
  try {
    const { database, collection } = req.params;
    const walletAddress = req.headers.authorization?.split(' ')[1] || null;

    if (!walletAddress) {
      return res.status(401).json({ error: "No wallet address provided" });
    }

    if (!(await checkAdmin(walletAddress))) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const coll = await getDbCollection(database, collection);
    const bannedEntities = await coll.find().toArray();

    res.json(bannedEntities);
  } catch (err) {
    console.error("Error in listBannedEntities:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { banEntity, unbanEntity, listBannedEntities };