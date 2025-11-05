const express = require("express");
const https = require("https");
const app = express();

const apiKey = "c1ce5c6b2338736d60e8a69ee4a101fd"; 

app.get("/weather", (req, res) => {
  const city = req.query.city || "Surat";
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  https.get(url, (response) => {
    let data = "";

    response.on("data", (chunk) => (data += chunk));

    response.on("end", () => {
      try {
        const weatherData = JSON.parse(data);
        if (weatherData.cod === 200) {
          res.send(`
            <h1>Weather in ${weatherData.name}</h1>
            <p>Temperature: ${weatherData.main.temp}°C</p>
            <p>Condition: ${weatherData.weather[0].description}</p>
            <p>Humidity: ${weatherData.main.humidity}%</p>
          `);
        } else {
          res.send(`<h2>Error: ${weatherData.message}</h2>`);
        }
      } catch (err) {
        res.send("<h2>Error reading weather data.</h2>");
      }
    });
  }).on("error", () => {
    res.send("<h2>Unable to fetch weather data.</h2>");
  });
});

app.listen(3000, () => {
  console.log(" Server running on http://localhost:3000");
});
