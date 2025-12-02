const clientPromise = require('../config/db');

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
      return res.status(400).json({ error: 'Request body is required' });
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.insertOne(data);
    res.status(201).json({ insertedId: result.insertedId, ...data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ - GET /{db}/{coll}/:id OR GET /{db}/{coll}?filter=...
const find = async (req, res) => {
  try {
    const { database, collection, id } = req.params;
    const { filter, projection, sort, limit = 50, skip = 0 } = req.query;

    const coll = await getDbCollection(database, collection);

    let query = {};
    if (id) {
      if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({ error: 'Invalid ObjectId' });
      }
      query = { _id: require('mongodb').ObjectId.createFromHexString(id) };
    } else if (filter) {
      try {
        query = JSON.parse(filter);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid filter JSON' });
      }
    }

    let cursor = coll.find(query);

    if (projection) {
      try {
        cursor = cursor.project(JSON.parse(projection));
      } catch {}
    }
    if (sort) {
      try {
        cursor = cursor.sort(JSON.parse(sort));
      } catch {}
    }

    const results = await cursor
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .toArray();

    res.json(id ? results[0] || null : results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE - PUT /{db}/{coll}/:id
const updateOne = async (req, res) => {
  try {
    const { database, collection, id } = req.params;
    const update = req.body;

    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ error: 'Valid id is required' });
    }
    if (!update || Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Update data is required' });
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.updateOne(
      { _id: require('mongodb').ObjectId.createFromHexString(id) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE - DELETE /{db}/{coll}/:id
const deleteOne = async (req, res) => {
  try {
    const { database, collection, id } = req.params;

    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ error: 'Valid id is required' });
    }

    const coll = await getDbCollection(database, collection);
    const result = await coll.deleteOne({
      _id: require('mongodb').ObjectId.createFromHexString(id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createOne, find, updateOne, deleteOne };