require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { initializeDatabase } = require("./db");
const authRoutes = require("./routes/auth");
const favoritesRoutes = require("./routes/favorites");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/favorites", favoritesRoutes);

app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  });
