// file: C:\_dev\repos\v0-dev\v0-db-api\src\middleware\auth.js
// src/middleware/auth.js
require('dotenv').config();

const API_BEARER_TOKEN = process.env.API_BEARER_TOKEN;

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== API_BEARER_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  next();
};

module.exports = auth;