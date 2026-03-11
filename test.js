const db = require("./db");

db.query("SELECT 1 + 1 AS result", (err, results) => {
  if (err) throw err;
  console.log(results);
});

const user = {
  email: "byeee@gmail.com",
  passwordhash: "testhash123"
};

const insertUserSql = "INSERT INTO users (email, passwordhash) VALUES (?, ?)";
db.query(insertUserSql, [user.email, user.passwordhash], (err, userResult) => {
  if (err) throw err;

  const userID = userResult.insertId;
  console.log("User inserted with ID:", userID);

  const route = {
    routeName: "HomeWork",
    startStreet: "123 Main St",
    startCity: "Seattle",
    startState: "WA",
    startZip: "98101",
    destStreet: "500 Pine St",
    destCity: "Seattle",
    destState: "WA",
    destZip: "98101"
  };

  const insertFavoriteRouteSql = `
    INSERT INTO favoriteRoutes
    (userID, routeName, startStreet, startCity, startState, startZip, destStreet, destCity, destState, destZip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertFavoriteRouteSql,
    [
      userID,
      route.routeName,
      route.startStreet,
      route.startCity,
      route.startState,
      route.startZip,
      route.destStreet,
      route.destCity,
      route.destState,
      route.destZip
    ],
    (routeErr, routeResult) => {
      if (routeErr) throw routeErr;
      console.log("Favorite route inserted with favID:", routeResult.insertId);
      db.end();
    }
  );
});

