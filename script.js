const apiKey = "c1ce5c6b2338736d60e8a69ee4a101fd";

document.getElementById("searchBtn").addEventListener("click", () => {
  const city = document.getElementById("cityInput").value;
  if (city) {
    getWeather(city);
  } else {
    alert("Please enter a city name!");
  }
});

async function getWeather(city) {
  const apiURL = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  try {
    const response = await fetch(apiURL);
    const data = await response.json();

    if (data.cod === "404") {
      alert("City not found!");
      return;
    }

    document.getElementById("cityName").innerText = `${data.name}, ${data.sys.country}`;
    document.getElementById("temperature").innerText = `🌡️ Temperature: ${data.main.temp} °C`;
    document.getElementById("description").innerText = `☁️ Weather: ${data.weather[0].description}`;
    document.getElementById("humidity").innerText = `💧 Humidity: ${data.main.humidity}%`;
    document.getElementById("windSpeed").innerText = `🌬️ Wind Speed: ${data.wind.speed} m/s`;
  } catch (error) {
    alert("Error fetching weather data!");
  }
}