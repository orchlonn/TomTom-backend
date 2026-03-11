const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();

function validatePassword(password) {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (password.length > 64) {
    return "Password must be 64 characters or fewer";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }

  if (!/[!@#$%^&*(),.?\":{}|<>_\-\\[\];'/`~+=]/.test(password)) {
    return "Password must contain at least one special character";
  }

  return null;
}

function buildAuthResponse(user) {
  const token = jwt.sign(
    {
      id: user.userID,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return {
    token,
    user: {
      id: user.userID,
      email: user.email,
    },
  };
}

router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const [existingUsers] = await pool.execute(
      "SELECT userID FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO users (email, passwordhash) VALUES (?, ?)",
      [email, passwordHash]
    );

    return res.status(201).json(
      buildAuthResponse({
        userID: result.insertId,
        email,
      })
    );
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Failed to register user" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT userID, email, passwordhash FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.passwordhash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    return res.json(buildAuthResponse(user));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Failed to log in" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Email and newPassword are required" });
  }

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const [rows] = await pool.execute(
      "SELECT userID, email FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      "UPDATE users SET passwordhash = ? WHERE userID = ?",
      [passwordHash, rows[0].userID]
    );

    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT userID, email FROM users WHERE userID = ? LIMIT 1",
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        id: rows[0].userID,
        email: rows[0].email,
      },
    });
  } catch (error) {
    console.error("Fetch current user error:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
