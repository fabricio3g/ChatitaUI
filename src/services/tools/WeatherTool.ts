import { Tool, ToolDefinition, ToolResponse } from './types';
import * as Location from 'expo-location';

export class WeatherTool implements Tool {
    definition: ToolDefinition = {
        name: 'get_weather',
        description: 'Get weather forecast. IMPORTANT: If user mentions "tomorrow", "next monday", or a specific date, you MUST pass the "date" parameter (e.g. "tomorrow" or "2026-01-28") to focus the result.',
        renderType: 'weather_card',
        parameters: {
            type: 'object',
            properties: {
                city: {
                    type: 'string',
                    description: 'Optional city name. If not provided, uses current GPS location.'
                },
                days: {
                    type: 'number',
                    description: 'Number of forecast days (1-10). Default is 5.'
                },
                date: {
                    type: 'string',
                    description: 'Optional date/day to focus on (e.g. "tomorrow", "monday", "2026-01-28").'
                }
            },
            required: []
        }
    };

    private getWeatherCondition(code: number): { label: string; icon: string } {
        if (code === 0) return { label: 'CLEAR SKY', icon: 'sun' };
        if (code <= 3) return { label: 'PARTLY CLOUDY', icon: 'cloud' };
        if (code <= 48) return { label: 'FOGGY', icon: 'cloud-drizzle' };
        if (code <= 57) return { label: 'DRIZZLE', icon: 'cloud-rain' };
        if (code <= 67) return { label: 'RAIN', icon: 'umbrella' };
        if (code <= 77) return { label: 'SNOW', icon: 'cloud-snow' };
        if (code <= 82) return { label: 'SHOWERS', icon: 'cloud-rain' };
        if (code <= 99) return { label: 'THUNDERSTORM', icon: 'cloud-lightning' };
        return { label: 'UNKNOWN', icon: 'help-circle' };
    }

    async execute(params: { city?: string; days?: number; date?: string }): Promise<ToolResponse> {
        try {
            let lat: number;
            let lon: number;
            let city = '';
            let region = '';
            let country = '';
            const days = Math.min(Math.max(params.days || 5, 1), 10); // Clamp 1-10 days

            // 1. Get Location
            if (params.city) {
                // Use Open-Meteo's free geocoding API (no API key needed, no permissions needed)
                console.log('[WeatherTool] Geocoding city:', params.city);
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(params.city)}&count=1&language=en&format=json`;
                const geoRes = await fetch(geoUrl);
                const geoData = await geoRes.json();
                
                if (!geoData.results || geoData.results.length === 0) {
                    throw new Error(`City not found: ${params.city}`);
                }
                
                const result = geoData.results[0];
                lat = result.latitude;
                lon = result.longitude;
                city = result.name || params.city;
                region = result.admin1 || '';
                country = result.country || '';
                console.log('[WeatherTool] Found location:', { city, region, country, lat, lon });
            } else {
                // GPS Location - requires permission
                console.log('[WeatherTool] Using GPS location');
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    // Return helpful error message instead of throwing
                    return {
                        type: 'weather_card',
                        content: 'Location permission denied. Please specify a city name (e.g., "weather in New York") or grant location permission in device settings.',
                        data: { error: 'Location permission denied' }
                    };
                }
                const location = await Location.getCurrentPositionAsync({});
                lat = location.coords.latitude;
                lon = location.coords.longitude;

                // Reverse geocode to get city name from GPS coords
                try {
                    const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
                    if (reverse.length > 0) {
                        city = reverse[0].city || reverse[0].name || 'Current Location';
                        region = reverse[0].region || reverse[0].subregion || '';
                        country = reverse[0].country || '';
                    } else {
                        city = 'Current Location';
                    }
                } catch (e) {
                    city = 'Current Location';
                }
            }

            // 2. Fetch Weather (Open-Meteo) including Daily Forecast
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=${days}`;
            console.log('[WeatherTool] Fetching:', url);

            const res = await fetch(url);
            if (!res.ok) throw new Error('Weather API unavailable');
            const data = await res.json();

            // 3. Transform Data
            const current = data.current;
            const daily = data.daily;
            let currentCondition = this.getWeatherCondition(current.weather_code);
            let currentTemp = Math.round(current.temperature_2m);
            let currentHigh = Math.round(daily.temperature_2m_max[0]);
            let currentLow = Math.round(daily.temperature_2m_min[0]);
            let targetDateDisplay: string | undefined = undefined;

            // Process Daily Forecast
            const forecast = daily.time.map((time: string, index: number) => {
                const condition = this.getWeatherCondition(daily.weather_code[index]);
                return {
                    // Use T12:00:00 to ensure we get the correct day name regardless of timezone/midnight
                    day: new Date(time + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
                    date: time,
                    high: Math.round(daily.temperature_2m_max[index]),
                    low: Math.round(daily.temperature_2m_min[index]),
                    condition: condition.label,
                    icon: condition.icon
                };
            });

            // 4. Handle Date override
            if (params.date) {
                const targetLower = params.date.toLowerCase();

                // Calculate "tomorrow" YYYY-MM-DD in local time
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const tomorrowStr = tomorrow.toISOString().split('T')[0];

                console.log(`[WeatherTool] Date match attempt for: "${targetLower}", Tomorrow Is: ${tomorrowStr}`);

                const match = forecast.find((f: any) => {
                    const dayName = f.day.toLowerCase();
                    const dateStr = f.date;

                    const isTomorrow = targetLower.includes('tomorrow') && dateStr === tomorrowStr;
                    const isNameMatch = dayName.includes(targetLower);
                    const isDateMatch = dateStr.includes(targetLower);

                    return isTomorrow || isNameMatch || isDateMatch;
                });

                if (match) {
                    currentTemp = match.high; // Use high temp for forecast view
                    currentHigh = match.high;
                    currentLow = match.low;
                    currentCondition = { label: match.condition, icon: match.icon };
                    targetDateDisplay = match.day; // e.g., "Tue"
                    console.log(`[WeatherTool] Focusing on forecast: ${match.date} (${match.day})`);
                }
            }

            const weatherData = {
                city,
                region,
                country,
                location: `${city}${region ? ', ' + region : ''}${country ? ', ' + country : ''}`,
                temperature: currentTemp,
                condition: currentCondition.label,
                icon: currentCondition.icon,
                humidity: current.relative_humidity_2m,
                windSpeed: current.wind_speed_10m,
                high: currentHigh,
                low: currentLow,
                forecast: forecast,
                targetDate: targetDateDisplay
            };

            // Enhanced text summary for LLM
            const forecastSummary = forecast.slice(0, 3).map((f: any) =>
                `${f.day}: ${f.condition}, H:${f.high}° L:${f.low}°`
            ).join('; ');

            const intro = targetDateDisplay
                ? `Forecast for ${city} on ${targetDateDisplay}`
                : `Current weather in ${city}`;

            return {
                type: 'weather_card',
                content: `${intro}: ${weatherData.temperature}°C, ${weatherData.condition}. High: ${weatherData.high}°, Low: ${weatherData.low}°. Forecast: ${forecastSummary}...`,
                data: weatherData
            };

        } catch (error: any) {
            console.error('[WeatherTool] Error:', error);
            return {
                type: 'error',
                content: `Could not get weather. ${error.message}`,
                data: { error: error.message }
            };
        }
    }
}
