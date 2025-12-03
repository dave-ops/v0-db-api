// file: C:\_dev\repos\v0-db-api\src\server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const auth = require("./middleware/auth");
const banCheck = require("./middleware/banCheck");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const logger = require("./middleware/logger");
const crudRoutes = require("./routes/crud");
const movieJoinRoutes = require("./routes/movieJoin");
const countryRoutes = require("./routes/countryRoutes");
const banRoutes = require("./routes/banRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
});
app.use("/api/", limiter);
app.use("/api/", banCheck); // Add ban check middleware before auth
app.use("/api/", auth);

// Logger middleware for all routes
app.use(logger);

app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/:database/:collection", crudRoutes);
app.use("/api/:database/:collection", banRoutes); // Add ban routes
app.use("/api", movieJoinRoutes);
app.use("/api", countryRoutes);

// Health check
app.get("/health", (req, res) => res.json({ status: "OK", time: new Date() }));

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.listen(PORT, () => {
  console.log(`MongoDB CRUD Service running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
});