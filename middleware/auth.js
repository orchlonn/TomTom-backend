// middleware/auth.js
// Middleware function to authenticate requests using JWT tokens
const jwt = require("jsonwebtoken");

// This function checks for the presence of a Bearer token in the Authorization header, 
// verifies it, and attaches the decoded user information to the request object if valid
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // Check if the Authorization header is present and starts with "Bearer "
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  // Extract the token from the header (removing the "Bearer " prefix)
  const token = authHeader.split(" ")[1];

  // Verify the token using the secret key and handle any errors that may occur during verification
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = authenticate;
