const axios = require('axios');

module.exports = {
    config: {
        name: "weather",
        aliases: ["w", "forecast"],
        description: "Get weather information for a location",
        guide: "{pn} <location>",
        author: "@anbuinfosec",
        role: 0,
        cooldown: 10,
        countDown: 10,
        category: "utility"
    },

    onStart: async ({ reply, event, args, utils, getLang }) => {
        try {
            const getText = getLang || ((key, ...args) => {
                const texts = {
                    missingLocation: "❌ Please provide a location!\nExample: weather London",
                    fetching: "🌤️ Getting weather information...",
                    locationNotFound: "❌ Location not found. Please check the spelling and try again.",
                    serviceUnavailable: "❌ Weather service unavailable. Please contact admin.",
                    error: "❌ Error fetching weather data. Please try again later.",
                    weatherReport: "%1 WEATHER REPORT %1\n\n📍 Location: %2, %3\n🌡️ Temperature: %4°C\n🤒 Feels Like: %5°C\n🌦️ Description: %6\n💧 Humidity: %7%\n🌪️ Wind Speed: %8 m/s\n👁️ Visibility: %9 km\n🌅 Sunrise: %10\n🌇 Sunset: %11\n📊 Pressure: %12 hPa"
                };
                let text = texts[key] || key;
                args.forEach((arg, index) => {
                    text = text.replace(new RegExp(`%${index + 1}`, 'g'), arg);
                });
                return text;
            });
            
            if (!args[0]) {
                return await reply(getText('missingLocation'));
            }
            
            const location = args.join(' ');
            
            // Using OpenWeatherMap API (free tier)
            const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=efed98a2e0f2ec1e29b2a4f78e6f6a5a&units=metric`;
            
            await reply(getText('fetching'));
            
            const response = await axios.get(apiUrl);
            const data = response.data;
            
            if (!data) {
                return await reply(getText('error'));
            }
            
            const weather = {
                location: data.name,
                country: data.sys.country,
                temperature: Math.round(data.main.temp),
                feelLike: Math.round(data.main.feels_like),
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                description: data.weather[0].description,
                wind: data.wind.speed,
                visibility: data.visibility / 1000,
                sunrise: new Date(data.sys.sunrise * 1000).toLocaleTimeString(),
                sunset: new Date(data.sys.sunset * 1000).toLocaleTimeString()
            };
            
            // Weather emoji based on condition
            const weatherEmoji = getWeatherEmoji(data.weather[0].main);
            
            const weatherMessage = getText('weatherReport', 
                weatherEmoji, weather.location, weather.country, weather.temperature,
                weather.feelLike, weather.description, weather.humidity, weather.wind,
                weather.visibility, weather.sunrise, weather.sunset, weather.pressure
            );

            await reply(weatherMessage);
            
        } catch (error) {
            console.error("Error in weather command:", error);
            
            const getText = getLang || ((key) => {
                const texts = {
                    locationNotFound: "❌ Location not found. Please check the spelling and try again.",
                    serviceUnavailable: "❌ Weather service unavailable. Please contact admin.",
                    error: "❌ Error fetching weather data. Please try again later."
                };
                return texts[key] || key;
            });
            
            if (error.response && error.response.status === 404) {
                await reply(getText('locationNotFound'));
            } else if (error.response && error.response.status === 401) {
                await reply(getText('serviceUnavailable'));
            } else {
                await reply(getText('error'));
            }
        }
    }
};

function getWeatherEmoji(weatherCondition) {
    const emojiMap = {
        'Clear': '☀️',
        'Clouds': '☁️',
        'Rain': '🌧️',
        'Drizzle': '🌦️',
        'Thunderstorm': '⛈️',
        'Snow': '❄️',
        'Mist': '🌫️',
        'Fog': '🌫️',
        'Haze': '🌫️',
        'Smoke': '🌫️',
        'Dust': '🌪️',
        'Sand': '🌪️',
        'Squall': '🌪️',
        'Tornado': '🌪️'
    };
    
    return emojiMap[weatherCondition] || '🌤️';
}
