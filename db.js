const mysql = require("mysql2/promise");

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "mydb",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      userID INT NOT NULL AUTO_INCREMENT,
      email VARCHAR(30) NOT NULL,
      passwordhash VARCHAR(60) NOT NULL,
      PRIMARY KEY (userID)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favoriteRoutes (
      userID INT NOT NULL,
      favID INT NOT NULL AUTO_INCREMENT,
      routeName VARCHAR(10) NOT NULL,
      startStreet VARCHAR(50) NULL,
      startCity VARCHAR(40) NULL,
      startState CHAR(2) NULL,
      startZip CHAR(5) NULL,
      destStreet VARCHAR(50) NULL,
      destCity VARCHAR(40) NULL,
      destState CHAR(2) NULL,
      destZip CHAR(5) NULL,
      PRIMARY KEY (favID),
      INDEX fk_uid_idx (userID ASC),
      CONSTRAINT fk_uid
        FOREIGN KEY (userID) REFERENCES users(userID)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favWaypoints (
      favID INT NOT NULL,
      wpID INT NOT NULL AUTO_INCREMENT,
      wpStreet VARCHAR(50) NULL,
      wpCity VARCHAR(40) NULL,
      wpState CHAR(2) NULL,
      wpZip CHAR(5) NULL,
      PRIMARY KEY (wpID),
      CONSTRAINT fk_stop_favID
        FOREIGN KEY (favID) REFERENCES favoriteRoutes(favID)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
    )
  `);
}

module.exports = {
  pool,
  initializeDatabase,
};
