const validateRequest = (req, res, next) => {
  const { database, collection } = req.params;
  if (!database || !collection) {
    return res.status(400).json({ error: 'database and collection are required' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(database) || !/^[a-zA-Z0-9_-]+$/.test(collection)) {
    return res.status(400).json({ error: 'Invalid database or collection name' });
  }
  next();
};

module.exports = { validateRequest };