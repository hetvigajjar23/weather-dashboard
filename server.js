<<<<<<< HEAD
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



// // server.js — Weather App (Basic Version)

// const express = require('express');
// const https   = require('https');
// const path    = require('path');

// const verifyToken = (req, res, next) => next();
// const optionalToken = (req, res, next) => next();

// // const { saveSearch, getSearches } = require('./db');
// // const { verifyToken, optionalToken } = require('./auth');

// const app = express();
// app.use(express.json());
// app.use(express.static(path.join(__dirname)));


// const WEATHER_KEY = "c1ce5c6b2338736d60e8a69ee4a101fd";

// // ─────────────────────────────
// // Fetch Weather
// // ─────────────────────────────
// function fetchWeather(city) {
//   return new Promise((resolve, reject) => {
//     const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_KEY}&units=metric`;

//     https.get(url, (response) => {
//       let data = '';

//       response.on('data', (chunk) => (data += chunk));

//       response.on('end', () => {
//         try {
//           resolve(JSON.parse(data));
//         } catch {
//           reject(new Error('Parse error'));
//         }
//       });

//     }).on('error', reject);
//   });
// }

// // ─────────────────────────────
// // Chatbot
// // ─────────────────────────────
// async function chatbotReply(message) {
//   const msg = message.toLowerCase();

//   if (msg.includes('hi') || msg.includes('hello')) {
//     return { reply: 'Hello 👋 Ask weather like "weather in Mumbai"' };
//   }

//   const match = msg.match(/weather in ([a-zA-Z\s]+)/);

//   if (match) {
//     const city = match[1].trim();

//     try {
//       const data = await fetchWeather(city);

//       if (data.cod === 200) {
//         return {
//           reply: `🌡️ ${data.main.temp}°C in ${data.name}`,
//           city: data.name
//         };
//       }
//     } catch {}

//     return { reply: 'City not found' };
//   }

//   return { reply: 'Try: weather in Delhi' };
// }

// // ─────────────────────────────
// // ROUTES
// // ─────────────────────────────

// // Weather
// app.get('/weather/:city', optionalToken, async (req, res) => {
//   try {
//     const data = await fetchWeather(req.params.city);

//     if (data.cod !== 200) {
//       return res.status(404).json({ error: 'City not found' });
//     }

//     const result = {
//       city: data.name,
//       country: data.sys.country,
//       temperature: data.main.temp,
//       description: data.weather[0].description,
//       humidity: data.main.humidity,
//       windSpeed: data.wind.speed,
//     };

//     await saveSearch({
//       ...result,
//       userId: req.user ? req.user.userId : 'guest',
//     });

//     res.json(result);

//   } catch {
//     res.status(500).json({ error: 'Server error' });
//   }
// });



// const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
// const { IamAuthenticator } = require('ibm-watson/auth');

// const speechToText = new SpeechToTextV1({
//   authenticator: new IamAuthenticator({
//     apikey: 'SwWqcCYF_9HqDSYWdV4WQ8M2-hJJBG2DrTxH09FaKTZ6',
//   }),
//   serviceUrl: 'https://api.au-syd.speech-to-text.watson.cloud.ibm.com/instances/d532fba4-de00-4488-88d9-bb1c253d1d18',
// });


// // History
// app.get('/history', verifyToken, async (req, res) => {
//   const data = await getSearches(req.user.userId);
//   res.json(data);
// });

// // Chatbot
// app.post('/chatbot', async (req, res) => {
//   const response = await chatbotReply(req.body.message);
//   res.json(response);
// });



// // Frontend
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });


// // Start
// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });



// // server.js — Weather App (Enhanced)
// require('dotenv').config();
// const express = require('express');
// const https   = require('https');
// const path    = require('path');

// const { saveSearch, getSearches } = require('./db');
// const { verifyToken, optionalToken } = require('./auth');

// const app = express();
// app.use(express.json());
// app.use(express.static(path.join(__dirname)));

// const WEATHER_KEY = process.env.OPENWEATHER_API_KEY;

// // ─────────────────────────────────────────────
// // Helper: fetch weather from OpenWeatherMap
// // ─────────────────────────────────────────────
// function fetchWeather(city) {
//   return new Promise((resolve, reject) => {
//     const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_KEY}&units=metric`;
//     https.get(url, (response) => {
//       let data = '';
//       response.on('data', (chunk) => (data += chunk));
//       response.on('end', () => {
//         try { resolve(JSON.parse(data)); }
//         catch (e) { reject(new Error('Failed to parse weather data')); }
//       });
//     }).on('error', reject);
//   });
// }

// // ─────────────────────────────────────────────
// // Simple Chatbot — pure JavaScript, no AWS Lex
// // Uses regex patterns to find a city name in
// // the user's message, then calls OpenWeatherMap
// // ─────────────────────────────────────────────
// async function chatbotReply(message) {
//   const msg = message.toLowerCase().trim();

//   // Greetings
//   if (msg.match(/^(hi|hello|hey|good morning|good evening|namaste)[\s!?]*$/)) {
//     return { reply: 'Hello! 👋 I can tell you the weather anywhere. Try: "weather in Surat" or "What is the weather in Mumbai?"' };
//   }

//   // Help
//   if (msg.includes('help') || msg.includes('what can you do')) {
//     return { reply: 'I can tell you the current weather for any city! Just type: "weather in Delhi" or "temperature in Ahmedabad".' };
//   }

//   // Thanks
//   if (msg.match(/thank|thanks|ty|thx/)) {
//     return { reply: 'You are welcome! 😊 Ask me about any city anytime.' };
//   }

//   // Extract city name from natural language
//   // Handles: "weather in Mumbai", "Mumbai weather",
//   //          "what is the weather in Delhi", "temperature in Surat"
//   const patterns = [
//     /weather\s+in\s+([a-zA-Z\s]+)/i,
//     /temperature\s+in\s+([a-zA-Z\s]+)/i,
//     /how is (?:the )?weather in\s+([a-zA-Z\s]+)/i,
//     /what is (?:the )?weather in\s+([a-zA-Z\s]+)/i,
//     /([a-zA-Z\s]+)\s+weather/i,
//     /([a-zA-Z\s]+)\s+temperature/i,
//   ];

//   let city = null;
//   for (const pattern of patterns) {
//     const match = msg.match(pattern);
//     if (match) {
//       city = match[1].trim();
//       break;
//     }
//   }

//   // If a city was found, fetch real weather data
//   if (city) {
//     try {
//       const data = await fetchWeather(city);
//       if (data.cod === 200) {
//         return {
//           reply: `Weather in ${data.name}, ${data.sys.country}: 🌡️ ${data.main.temp}°C, ${data.weather[0].description}, 💧 Humidity: ${data.main.humidity}%, 🌬️ Wind: ${data.wind.speed} m/s`,
//           city: data.name,
//         };
//       } else {
//         return { reply: `Sorry, I could not find "${city}". Please check the city name.` };
//       }
//     } catch (err) {
//       return { reply: 'Sorry, I had trouble fetching weather data. Please try again.' };
//     }
//   }

//   // Default fallback
//   return { reply: 'I did not understand that. Try: "weather in Chennai" or "temperature in Jaipur".' };
// }

// // ─────────────────────────────────────────────
// // ROUTE 1: GET /weather/:city
// // Public — saves each search to Cloudant
// // ─────────────────────────────────────────────
// app.get('/weather/:city', optionalToken, async (req, res) => {
//   const city = req.params.city;
//   try {
//     const data = await fetchWeather(city);

//     if (data.cod !== 200) {
//       return res.status(404).json({ error: data.message || 'City not found' });
//     }

//     const result = {
//       city:        data.name,
//       country:     data.sys.country,
//       temperature: data.main.temp,
//       description: data.weather[0].description,
//       humidity:    data.main.humidity,
//       windSpeed:   data.wind.speed,
//       icon:        data.weather[0].icon,
//     };

//     await saveSearch({
//       city: city.toLowerCase(),
//       ...result,
//       userId: req.user ? req.user.userId : 'anonymous',
//     });

//     res.json(result);
//   } catch (err) {
//     res.status(500).json({ error: 'Error fetching weather data' });
//   }
// });

// // ─────────────────────────────────────────────
// // ROUTE 2: GET /history
// // Protected — must be logged in via Cognito
// // Returns this user's past searches from Cloudant
// // ─────────────────────────────────────────────
// app.get('/history', verifyToken, async (req, res) => {
//   try {
//     const searches = await getSearches(req.user.userId);
//     res.json(searches);
//   } catch (err) {
//     res.status(500).json({ error: 'Could not fetch history' });
//   }
// });

// // ─────────────────────────────────────────────
// // ROUTE 3: POST /chatbot
// // Receives a text message, returns bot reply
// // Uses our own chatbotReply() — no AWS Lex
// // ─────────────────────────────────────────────
// app.post('/chatbot', async (req, res) => {
//   const { message } = req.body;
//   if (!message) {
//     return res.status(400).json({ error: 'Message is required' });
//   }
//   const response = await chatbotReply(message);
//   res.json(response);
// });

// // ─────────────────────────────────────────────
// // ROUTE 4: Serve frontend (index.html)
// // ─────────────────────────────────────────────
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, 'index.html'));
// });

// // ─────────────────────────────────────────────
// // START SERVER
// // ─────────────────────────────────────────────
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//   console.log(`✅ Server running on http://localhost:${PORT}`);
// });
=======
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
>>>>>>> d7b7a0b1165e91474a941c07d26f1c62d257a5a5
