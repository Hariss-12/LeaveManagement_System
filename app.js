
const express = require("express");
const cors = require("cors");
const path = require("node:path");
const connectDB = require("./config/db");
const leaveRoutes = require("./routes/leaveRoutes");

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Leave Management API is running",
  });
});

// Serve the browser application at the site root.
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Register all leave-management routes under /api
app.use("/api", leaveRoutes);

// Handle unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
});

// Handle unexpected errors
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.status === 400
      ? "Invalid request data"
      : "Internal server error",
  });
});

// Connect to MongoDB, then start the server
async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Backend running at http://localhost:${PORT}`);
      console.log(`API health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error("Failed to start the server:", error.message);
    process.exit(1);
  }
}

startServer();
