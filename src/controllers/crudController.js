const clientPromise = require("../config/db");
const { ObjectId } = require("mongodb");

const getDbCollection = async (dbName, collName) => {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db.collection(collName);
};

// CREATE - POST /{db}/{coll}
const createOne = async (req, res) => {
  try {
    const { database, collection } = req.params;
    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(400).json({ error: "Request body is required" });
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.insertOne(data);

    res.status(201).json({ insertedId: result.insertedId, ...data });
  } catch (err) {
    console.error("Error in createOne:", err);
    res.status(500).json({ error: err.message });
  }
};

// READ - GET /{db}/{coll}/:id OR GET /{db}/{coll}?filter=...
const find = async (req, res) => {
  try {
    const { database, collection, id } = req.params;
    const { filter, projection, sort, limit = 50, skip = 0 } = req.query;

    console.log(`find request → id: ${id}, filter: ${filter}`);

    const coll = await getDbCollection(database, collection);

    let query = {};

    if (id) {
      // Case 1: 24-char hex string → MongoDB _id (ObjectId)
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        try {
          query = { _id: ObjectId.createFromHexString(id) };
        } catch (e) {
          return res.status(400).json({ error: "Invalid ObjectId format" });
        }
      }
      // Case 2: Numeric string like "11705" → custom numeric 'id' field
      else {
        const numId = parseInt(id, 10);
        if (!isNaN(numId)) {
          query = { id: numId };
        } else {
          query = { id: id }; // fallback for string ids
        }
      }
    } else if (filter) {
      try {
        query = JSON.parse(filter);
      } catch (e) {
        return res.status(400).json({ error: "Invalid filter JSON" });
      }
    }

    let cursor = coll.find(query);

    if (projection) {
      try {
        cursor = cursor.project(JSON.parse(projection));
      } catch (e) {
        return res.status(400).json({ error: "Invalid projection JSON" });
      }
    }

    if (sort) {
      try {
        cursor = cursor.sort(JSON.parse(sort));
      } catch (e) {
        return res.status(400).json({ error: "Invalid sort JSON" });
      }
    }

    const results = await cursor
      .skip(parseInt(skip, 10))
      .limit(parseInt(limit, 10))
      .toArray();

    res.json(id ? (results[0] || null) : results);
  } catch (err) {
    console.error("Error in find:", err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE - PUT /{db}/{coll}/:id
const updateOne = async (req, res) => {
  try {
    const { database, collection, id } = req.params;
    const update = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID is required in URL" });
    }

    let filter = {};
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      filter = { _id: ObjectId.createFromHexString(id) };
    } else {
      const numId = parseInt(id, 10);
      filter = !isNaN(numId) ? { id: numId } : { id: id };
    }

    if (!update || Object.keys(update).length === 0) {
      return res.status(400).json({ error: "Update data is required" });
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.updateOne(filter, { $set: update });

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      modified: result.modifiedCount > 0,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("Error in updateOne:", err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE - DELETE /{db}/{coll}/:id
const deleteOne = async (req, res) => {
  try {
    const { database, collection, id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "ID is required" });
    }

    let filter = {};
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      filter = { _id: ObjectId.createFromHexString(id) };
    } else {
      const numId = parseInt(id, 10);
      filter = !isNaN(numId) ? { id: numId } : { id: id };
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.deleteOne(filter);

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    console.error("Error in deleteOne:", err);
    res.status(500).json({ error: err.message });
  }
};

const upsertUserSettings = async (req, res) => {
    const { database, collection } = req.params;
    const data = req.body;
    const walletAddress = data.id;

    if (!walletAddress) {
        res.status(400).json({ error: "Wallet address (id) is required" });
        return;
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.updateOne(
        { id: walletAddress },
        { $set: data },
        { upsert: true }
    );

    res.status(200).json({
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId,
        settings: data
    });
};

// Add to exports
module.exports = { createOne, find, updateOne, deleteOne, upsertUserSettings };
