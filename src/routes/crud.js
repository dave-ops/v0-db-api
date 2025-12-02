const express = require('express');
const { validateRequest } = require('../middleware/validate');
const { createOne, find, updateOne, deleteOne } = require('../controllers/crudController');

const router = express.Router({ mergeParams: true });

// POST   /api/users/myapp
router.post('/', validateRequest, createOne);

// GET    /api/users/myapp            -> find many
// GET    /api/users/myapp/abc123     -> find one by id
// GET    /api/users/myapp?filter={"age":{$gt:18}}
router.get('/:id?', validateRequest, find);

// PUT    /api/users/myapp/abc123
router.put('/:id', validateRequest, updateOne);

// DELETE /api/users/myapp/abc123
router.delete('/:id', validateRequest, deleteOne);

module.exports = router;