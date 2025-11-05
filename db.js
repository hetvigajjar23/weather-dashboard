const mysql = require('mysql2');

const con = mysql.createConnection({
  host: "host.docker.internal",    
  user: "root",          
  password: "Hetvee#1704",      
  database: "studentdb",
  port: 3306             
});

con.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log(" Connected to MySQL Database!");
});

module.exports = con;
