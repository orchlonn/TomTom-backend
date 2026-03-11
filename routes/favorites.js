const express = require("express");
const { pool } = require("../db");
const authenticate = require("../middleware/auth");

const router = express.Router();

router.use(authenticate);

// Utility functions for address parsing and formatting
function splitAddress(value) {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  // Return an object with the address components, using null for any missing parts
  return {
    street: parts[0] || null,
    city: parts[1] || null,
    state: parts[2] || null,
    zip: parts[3] || null,
  };
}

// Join address components into a single string, skipping any that are null or empty
function joinAddress(street, city, state, zip) {
  return [street, city, state, zip].filter(Boolean).join(", ");
}

// Normalize a waypoint row from the database into the expected format for the frontend
function normalizeWaypoint(row) {
  return {
    query: joinAddress(row.wpStreet, row.wpCity, row.wpState, row.wpZip),
    coords: null,
  };
}

// Load waypoints for a list of favorite IDs and return a map of favID to waypoints array
async function loadWaypointsForFavorites(favoriteIds) {
  if (favoriteIds.length === 0) {
    return new Map();
  }

  // Create a string of placeholders for the SQL IN clause, e.g. "?, ?, ?"
  const placeholders = favoriteIds.map(() => "?").join(", ");
  const [rows] = await pool.execute(
    `SELECT favID, wpStreet, wpCity, wpState, wpZip
     FROM favWaypoints
     WHERE favID IN (${placeholders})
     ORDER BY wpID ASC`,
    favoriteIds
  );

  // Group waypoints by their favID
  const waypointsByFavoriteId = new Map();

  // Normalize each waypoint and add it to the corresponding favID group
  rows.forEach((row) => {
    const current = waypointsByFavoriteId.get(row.favID) || [];
    current.push(normalizeWaypoint(row));
    waypointsByFavoriteId.set(row.favID, current);
  });

  return waypointsByFavoriteId;
}

// Get all favorite routes for the authenticated user
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT favID, routeName, startStreet, startCity, startState, startZip,
              destStreet, destCity, destState, destZip
       FROM favoriteRoutes
       WHERE userID = ?
       ORDER BY favID DESC`,
      [req.user.id]
    );

    // Extract the list of favorite IDs to load their waypoints in a single query
    const favoriteIds = rows.map((row) => row.favID);
    const waypointsByFavoriteId = await loadWaypointsForFavorites(favoriteIds);

    // Map the favorite routes to the expected response format, including their waypoints
    return res.json({
      favorites: rows.map((row) => ({
        id: row.favID,
        route_name: row.routeName,
        start_location: joinAddress(
          row.startStreet,
          row.startCity,
          row.startState,
          row.startZip
        ),
        end_location: joinAddress(
          row.destStreet,
          row.destCity,
          row.destState,
          row.destZip
        ),
        route_data: {
          waypoints: waypointsByFavoriteId.get(row.favID) || [],
        },
      })),
    });
  } catch (error) {
    console.error("Fetch favorites error:", error);
    return res.status(500).json({ error: "Failed to fetch favorite routes" });
  }
});

// Create a new favorite route for the authenticated user
router.post("/", async (req, res) => {
  const { routeName, startLocation, endLocation, routeData } = req.body;

  // Validate required fields
  if (!routeName || !startLocation || !endLocation) {
    return res.status(400).json({
      error: "routeName, startLocation, and endLocation are required",
    });
  }

  // Validate that routeName is not too long to prevent database issues
  if (routeName.length > 10) {
    return res.status(400).json({
      error: "routeName must be 10 characters or fewer",
    });
  }

  // Parse the start and end locations into their components for database storage
  const startAddress = splitAddress(startLocation);
  const destAddress = splitAddress(endLocation);
  const waypointQueries = Array.isArray(routeData?.waypoints)
    ? routeData.waypoints
    : [];

  // Check if the user already has a favorite with the same name to prevent duplicates
  try {
    const [favoriteCountRows] = await pool.execute(
      `SELECT COUNT(*) AS favoriteCount
       FROM favoriteRoutes
       WHERE userID = ?`,
      [req.user.id]
    );

    if (favoriteCountRows[0].favoriteCount >= 5) {
      return res.status(409).json({
        error: "You can only save up to 5 favorite routes",
      });
    }

    const [existingFavorites] = await pool.execute(
      `SELECT favID
       FROM favoriteRoutes
       WHERE userID = ? AND routeName = ?
       LIMIT 1`,
      [req.user.id, routeName]
    );

    // If a favorite with the same name already exists, return a 409 Conflict error
    if (existingFavorites.length > 0) {
      return res.status(409).json({
        error: "You already have a favorite with that name",
      });
    }

    // Insert the new favorite route into the database and get its generated ID
    const [result] = await pool.execute(
      `INSERT INTO favoriteRoutes
        (userID, routeName, startStreet, startCity, startState, startZip,
         destStreet, destCity, destState, destZip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        routeName,
        startAddress.street,
        startAddress.city,
        startAddress.state,
        startAddress.zip,
        destAddress.street,
        destAddress.city,
        destAddress.state,
        destAddress.zip,
      ]
    );

    // Insert each waypoint into the favWaypoints table, associating it with the new favorite route ID
    for (const waypoint of waypointQueries) {
      const address = splitAddress(waypoint.query);
      await pool.execute(
        `INSERT INTO favWaypoints (favID, wpStreet, wpCity, wpState, wpZip)
         VALUES (?, ?, ?, ?, ?)`,
        [
          result.insertId,
          address.street,
          address.city,
          address.state,
          address.zip,
        ]
      );
    }

    // Return the newly created favorite route in the response, including its generated ID and waypoints
    return res.status(201).json({
      favorite: {
        id: result.insertId,
        route_name: routeName,
        start_location: startLocation,
        end_location: endLocation,
        route_data: {
          waypoints: waypointQueries.map((waypoint) => ({
            query: waypoint.query,
            coords: null,
          })),
        },
      },
    });
  } catch (error) {
    console.error("Create favorite error:", error);
    return res.status(500).json({ error: "Failed to save favorite route" });
  }
});

// Delete a favorite route by its ID for the authenticated user
router.delete("/:id", async (req, res) => {
  try {
    await pool.execute("DELETE FROM favWaypoints WHERE favID = ?", [
      req.params.id,
    ]);

    // Delete the favorite route itself, ensuring it belongs to the authenticated user
    const [result] = await pool.execute(
      "DELETE FROM favoriteRoutes WHERE favID = ? AND userID = ?",
      [req.params.id, req.user.id]
    );

    // If no rows were affected, it means the favorite route was not found or did not belong to the user
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Favorite route not found" });
    }

    // Return a 204 No Content response to indicate successful deletion without returning any content
    return res.status(204).send();
  } catch (error) {
    console.error("Delete favorite error:", error);
    return res.status(500).json({ error: "Failed to delete favorite route" });
  }
});

// Update an existing favorite route by its ID for the authenticated user
module.exports = router;
