// file: C:\_dev\repos\v0-db-api\src\routes\banRoutes.js
const express = require('express');
const { validateRequest } = require('../middleware/validate');
const { banEntity, unbanEntity, listBannedEntities } = require('../controllers/banController');

const router = express.Router({ mergeParams: true });

// POST /api/:database/:collection/bans - Ban an IP or wallet address
router.post('/bans', validateRequest, banEntity);

// DELETE /api/:database/:collection/bans/:id - Unban an IP or wallet address
router.delete('/bans/:id', validateRequest, unbanEntity);

// GET /api/:database/:collection/bans - List all banned entities
router.get('/bans', validateRequest, listBannedEntities);

module.exports = router;