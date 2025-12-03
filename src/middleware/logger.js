// file: C:\_dev\repos\v0-db-api\src\middleware\logger.js
const clientPromise = require("../config/db");
const { v4: uuidv4 } = require('uuid');

const getDbCollection = async (dbName, collName) => {
  const client = await clientPromise;
  const db = client.db(dbName);
  return db.collection(collName);
};

const logger = async (req, res, next) => {
  const startTime = new Date();
  const requestId = uuidv4();

  // Capture request details
  const requestLog = {
    requestId,
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body ? { ...req.body } : {},
    ip: req.ip,
    timestamp: startTime,
    authorization: req.headers.authorization || 'None'
  };

  // Log request to console
  console.log(`[REQUEST ${requestId}] ${req.method} ${req.url} at ${startTime.toISOString()}`);
  console.log(`[REQUEST ${requestId}] Authorization: ${requestLog.authorization}`);
  console.log(`[REQUEST ${requestId}] Body:`, requestLog.body);

  // Store request log in MongoDB
  try {
    const coll = await getDbCollection('maga-movies', 'logs');
    await coll.insertOne({
      type: 'request',
      ...requestLog
    });
  } catch (error) {
    console.error(`[REQUEST ${requestId}] Error saving request log to MongoDB:`, error.message);
  }

  // Capture response data
  const originalSend = res.send;
  res.send = function (body) {
    const endTime = new Date();
    const duration = endTime - startTime;

    // Capture response details
    const responseLog = {
      requestId,
      status: res.statusCode,
      body: typeof body === 'string' ? JSON.parse(body) : body,
      headers: res.getHeaders(),
      timestamp: endTime,
      durationMs: duration
    };

    // Log response to console
    console.log(`[RESPONSE ${requestId}] Status: ${res.statusCode} at ${endTime.toISOString()} (${duration}ms)`);
    console.log(`[RESPONSE ${requestId}] Body:`, responseLog.body);

    // Store response log in MongoDB
    getDbCollection('maga-movies', 'logs')
      .then(coll => {
        return coll.insertOne({
          type: 'response',
          ...responseLog
        });
      })
      .catch(error => {
        console.error(`[RESPONSE ${requestId}] Error saving response log to MongoDB:`, error.message);
      });

    return originalSend.call(this, body);
  };

  next();
};

module.exports = logger;