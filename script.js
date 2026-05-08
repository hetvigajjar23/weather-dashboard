const $ = id => document.getElementById(id);
let currentEmail = localStorage.weatherEmail || null;

window.onload = () => currentEmail ? showApp(currentEmail) : $('loginModal').style.display = 'flex';

const showError = (msg, success = false) => {
  const el = $('authError');
  el.textContent = msg;
  el.style.color = success ? '#27ae60' : '#ff6b6b';
};

const saveEmail = email => {
  currentEmail = email;
  localStorage.weatherEmail = email;
  showApp(email);
};

function loginUser() {
  const email = $('loginEmail').value.trim().toLowerCase();
  const password = $('loginPassword').value.trim();
  if (!email || !password) return showError('Please enter your email and password.');
  const users = JSON.parse(localStorage.weatherUsers || '{}');
  console.log('Login attempt - Email:', email, 'Stored users:', Object.keys(users));
  if (users[email] === password) {
    $('loginPassword').value = '';
    return saveEmail(email);
  }
  showError('Invalid email or password.');
  $('loginPassword').value = '';
}

function registerUser() {
  const email = $('loginEmail').value.trim().toLowerCase();
  const password = $('loginPassword').value.trim();
  if (!email || !password) return showError('Please enter email and password to register.');
  const users = JSON.parse(localStorage.weatherUsers || '{}');
  if (users[email]) return showError('User already exists.');
  users[email] = password;
  localStorage.weatherUsers = JSON.stringify(users);
  console.log('User registered:', email);
  $('loginPassword').value = '';
  showError('✅ Account created! You can now sign in.', true);
}

function skipLogin() {
  saveEmail('guest');
  $('loginModal').style.display = 'none';
}

function showApp(email) {
  console.log('showApp called with:', email);
  const modal = $('loginModal');
  const app = $('mainApp');
  if (!modal || !app) {
    console.error('Modal or mainApp element not found');
    return;
  }
  modal.style.display = 'none';
  app.style.display = 'block';
  $('userLabel').textContent = '👤 ' + email;
  $('logoutBtn').style.display = 'inline-block';
  console.log('Weather page should now be visible');
  if (email !== 'guest') loadHistory();
}

function logout() {
  localStorage.removeItem('weatherEmail');
  location.reload();
}

function displayWeather(data) {
  $('weatherInfo').style.display = 'block';
  $('cityName').innerText = `${data.city}, ${data.country}`;
  $('temperature').innerText = `${data.temperature} °C`;
  $('description').innerText = data.description;
  $('humidity').innerText = `${data.humidity}%`;
  $('windSpeed').innerText = `${data.windSpeed} m/s`;
}

async function getWeather(cityOverride) {
  const city = cityOverride || $('cityInput').value.trim();
  if (!city) return alert('Please enter a city name!');
  $('cityInput').value = city;

  try {
    const res = await fetch('/weather/' + encodeURIComponent(city), {
      headers: currentEmail ? { 'x-user-email': currentEmail } : {}
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error || 'City not found. Please check the spelling.');
    displayWeather(data);
    if (currentEmail && currentEmail !== 'guest') loadHistory();
  } catch {
    alert('Network error. Please check your connection.');
  }
}

async function loadHistory() {
  if (!currentEmail || currentEmail === 'guest') return;
  try {
    const res = await fetch('/history', { headers: { 'x-user-email': currentEmail } });
    const data = await res.json();
    $('historySection').style.display = 'block';
    const list = $('historyList');
    list.innerHTML = '';
    data.slice(0, 8).forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${item.city}</strong> — ${item.temperature}°C, ${item.description}<small>${new Date(item.timestamp).toLocaleString()}</small>`;
      li.onclick = () => getWeather(item.city);
      list.appendChild(li);
    });
  } catch {
    // ignore history errors
  }
}

let recognition = null;
function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert('Voice search only works in Chrome or Edge. Please use those browsers.');
  if (recognition) return recognition.stop(), recognition = null;

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  const micBtn = $('micBtn');
  const statusEl = $('voiceStatus');
  micBtn.textContent = '🔴';
  statusEl.textContent = '🎙️ Listening... say a city name';

  recognition.onresult = event => {
    const spoken = event.results[0][0].transcript;
    statusEl.textContent = `Heard: "${spoken}"`;
    $('cityInput').value = spoken;
    micBtn.textContent = '🎙️';
    recognition = null;
    getWeather(spoken);
  };
  recognition.onerror = event => {
    statusEl.textContent = `Mic error: ${event.error}. Try typing instead.`;
    micBtn.textContent = '🎙️';
    recognition = null;
  };
  recognition.onend = () => { micBtn.textContent = '🎙️'; recognition = null; };
  recognition.start();
}

function toggleChat() {
  const box = $('chatBox');
  box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}

function appendChatMsg(text, sender) {
  const div = document.createElement('div');
  div.className = sender === 'user' ? 'user-msg' : 'bot-msg';
  div.textContent = text;
  const msgs = $('chatMessages');
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

async function sendChat() {
  const input = $('chatInput');
  const message = input.value.trim();
  if (!message) return;
  appendChatMsg(message, 'user');
  input.value = '';
  try {
    const res = await fetch('/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    appendChatMsg(data.reply, 'bot');
    if (data.city) $('cityInput').value = data.city;
  } catch {
    appendChatMsg('Sorry, something went wrong. Please try again.', 'bot');
  }
}
