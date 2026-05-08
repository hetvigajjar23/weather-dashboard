// server.js — Weather App (Fixed Version)

const express = require('express');
const https   = require('https');
const path    = require('path');
const { CloudantV1 } = require('@ibm-cloud/cloudant');
const { IamAuthenticator } = require('ibm-cloud-sdk-core');

const CLOUDANT_API_KEY = process.env.CLOUDANT_API_KEY || 'eMqDi6kCtiqSxy8XxpmGLs5xzx1EiuO4UADjT9qHjfKw';
const CLOUDANT_URL     = process.env.CLOUDANT_URL || 'https://aa713a1a-0fdf-4e9f-b00a-5adf7054cacf-bluemix.cloudant.com';
const CLOUDANT_DB      = process.env.CLOUDANT_DB || 'weather-dashboard';

const cloudantClient = CLOUDANT_API_KEY && CLOUDANT_URL
  ? CloudantV1.newInstance({
      authenticator: new IamAuthenticator({ apikey: CLOUDANT_API_KEY }),
      serviceUrl: CLOUDANT_URL,
    })
  : null;

async function ensureCloudantDb() {
  if (!cloudantClient) return;
  try {
    await cloudantClient.putDatabase({ db: CLOUDANT_DB });
  } catch (err) {
    if (err.status === 412) return;
    console.error('Cloudant DB create failed:', err.message || err);
  }
}

async function saveSearch(search) {
  if (!cloudantClient) {
    console.warn('Cloudant client not available; skipping search save.');
    return;
  }
  try {
    const doc = {
      ...search,
      _id: `${search.userId}_${Date.now()}`,
      //timestamp: new Date().toISOString()
    };
    const response = await cloudantClient.postDocument({ db: CLOUDANT_DB, document: doc });
    console.log('Saved weather search to Cloudant:', doc._id, response.result?.ok ? 'OK' : response.result);
  } catch (err) {
    console.error('Save search failed:', err.message || err);
  }
}

async function getSearches(userId) {
  if (!cloudantClient) return [];
  try {
    const response = await cloudantClient.postFind({
      db: CLOUDANT_DB,
      selector: { userId }
    });
    return response.result.docs.map(doc => ({
      city: doc.city,
      temperature: doc.temperature,
      description: doc.description,
      timestamp: doc.timestamp
    }));
  } catch (err) {
    console.error('Get searches failed:', err.message);
    return [];
  }
}

function verifyToken(req, res, next) {
  const email = req.header('x-user-email');
  if (!email) {
    return res.status(401).json({ error: 'Missing user email header' });
  }
  req.user = { userId: email.toLowerCase() };
  next();
}

function optionalToken(req, res, next) {
  const email = req.header('x-user-email');
  if (email) {
    req.user = { userId: email.toLowerCase() };
  }
  next();
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const WEATHER_KEY = "c1ce5c6b2338736d60e8a69ee4a101fd";

// ─────────────────────────────
// Fetch Weather from API
// ─────────────────────────────
function fetchWeather(city) {
  return new Promise((resolve, reject) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_KEY}&units=metric`;

    https.get(url, (response) => {
      let data = '';

      response.on('data', (chunk) => (data += chunk));

      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Parse error'));
        }
      });

    }).on('error', reject);
  });
}

// ─────────────────────────────
// Chatbot Logic
// ─────────────────────────────
async function chatbotReply(message) {
  const msg = message.toLowerCase();

  if (msg.includes('hi') || msg.includes('hello')) {
    return { reply: 'Hello 👋 Ask weather like "weather in Mumbai"' };
  }

  const match = msg.match(/weather in ([a-zA-Z\s]+)/);

  if (match) {
    const city = match[1].trim();

    try {
      const data = await fetchWeather(city);

      if (data.cod === 200) {
        return {
          reply: `🌡️ ${data.main.temp}°C in ${data.name}`,
          city: data.name
        };
      }
    } catch {}

    return { reply: 'City not found' };
  }

  return { reply: 'Try: weather in Delhi' };
}

// ─────────────────────────────
// ROUTES
// ─────────────────────────────

//  Weather API route (FIXED)
app.get('/weather/:city', optionalToken, async (req, res) => {
  try {
    const city = req.params.city;
    const data = await fetchWeather(city);

    if (data.cod !== 200) {
      return res.status(404).json({ error: 'City not found' });
    }

    const result = {
      city: data.name,
      country: data.sys.country,
      temperature: data.main.temp,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
    };

    res.json(result);

    // Save search to Cloudant
    await saveSearch({
      ...result,
      userId: req.user ? req.user.userId : 'guest',
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

//  History route (FIXED)
app.get('/history', verifyToken, async (req, res) => {
  try {
    const searches = await getSearches(req.user.userId);
    res.json(searches);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch history' });
  }
});

//  Chatbot route
app.post('/chatbot', async (req, res) => {
  const response = await chatbotReply(req.body.message);
  res.json(response);
});

//  Frontend route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─────────────────────────────
// START SERVER
// ─────────────────────────────
const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  await ensureCloudantDb();
});
