const express = require('express');
const https = require('https');
const db = require('./db');   

const app = express();
app.use(express.json());

const OPENWEATHER_API_KEY = 'your_api_key_here'; 

// 1: get weather of a city
app.get('/weather/:city', (req, res) => {
    const city = req.params.city; //params means parameter which are passed inside in the URL
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHER_API_KEY}&units=metric`;

    https.get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
            try {
                const weatherData = JSON.parse(data);
                res.json(weatherData);
            } catch (error) {
                res.status(500).json({ error: 'Error reading weather data' });
            }
        });
    }).on('error', (err) => {
        res.status(500).json({ error: 'Error fetching weather data' });
    });
});

//  2: Get all favorite cities
app.get('/favorites', (req, res) => {
    db.query('SELECT * FROM favorites', (err, results) => {
        if (err) res.status(500).json({ error: err });
        else res.json(results);
    });
});

// 3: Add a city to favorites
app.post('/favorites', (req, res) => {
    const { city } = req.body;
    db.query('INSERT INTO favorites (city) VALUES (?)', [city], (err) => {
        if (err) res.status(500).json({ error: err });
        else res.json({ message: 'City added to favorites!' });
    });
});

//  Route 4: delete a city from favorites
app.delete('/favorites/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM favorites WHERE id = ?', [id], (err) => {
        if (err) res.status(500).json({ error: err });
        else res.json({ message: 'City removed from favorites!' });
    });
});

app.get('/', (req, res) => {
  res.send('Server is running successfully ');
});

app.listen(3000, () => {
    console.log(' Server running on port 3000');
});
