// Weather from Open-Meteo — free, no API key and no signup, matching the rest of
// the app's stack (OSM tiles, OSRM routing, OpenFreeMap). Every destination is
// fetched in ONE batched request: Bohol is small but not uniform (the inland
// highlands run several degrees cooler than the coast), so a single island-wide
// reading would be wrong for half the map.
import { MaterialIcons } from '@expo/vector-icons';

// Open-Meteo's hard limit. Plans further out than this simply have no forecast
// yet — the UI says so rather than inventing one.
export const FORECAST_DAYS = 16;

export interface DayForecast {
  date: string; // ISO yyyy-mm-dd, local Bohol calendar day
  code: number; // WMO weather code
  tempMax: number;
  tempMin: number;
  rainChance: number; // %
}

export interface DestinationWeather {
  current: { tempC: number; code: number; isDay: boolean } | null;
  daily: DayForecast[];
}

export type WeatherByDestination = Record<number, DestinationWeather>;

/** Anywhere a forecast is wanted: a curated spot, or the province centre. */
export interface WeatherPoint {
  id: number;
  latitude: number;
  longitude: number;
}

// Identifies the forecast for the province itself, used when the app is pointed
// somewhere with no curated spots of its own.
export const REGION_POINT_ID = -1;

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export async function fetchWeather(points: WeatherPoint[]): Promise<WeatherByDestination> {
  if (points.length === 0) return {};
  const lat = points.map((d) => d.latitude).join(',');
  const lng = points.map((d) => d.longitude).join(',');
  const url =
    `${ENDPOINT}?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    // Ask for Bohol's calendar days, so "Saturday" means Saturday there and not
    // in the phone's timezone.
    `&timezone=Asia%2FManila&forecast_days=${FORECAST_DAYS}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const json = await res.json();
  // One location returns an object; several return an array — and a province
  // with no curated spots really is a single point, so both shapes happen.
  const list = Array.isArray(json) ? json : [json];

  const out: WeatherByDestination = {};
  points.forEach((d, i) => {
    const entry = list[i];
    if (!entry?.daily) return;
    const daily: DayForecast[] = entry.daily.time.map((date: string, j: number) => ({
      date,
      code: entry.daily.weather_code[j] ?? 0,
      tempMax: entry.daily.temperature_2m_max[j],
      tempMin: entry.daily.temperature_2m_min[j],
      rainChance: entry.daily.precipitation_probability_max[j] ?? 0,
    }));
    out[d.id] = {
      current: entry.current
        ? {
            tempC: entry.current.temperature_2m,
            code: entry.current.weather_code ?? 0,
            isDay: entry.current.is_day === 1,
          }
        : null,
      daily,
    };
  });
  return out;
}

/* ---------------- WMO weather codes ---------------- */

// Open-Meteo returns WMO codes; these are the bands that actually matter to
// someone deciding whether to visit a waterfall today.
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 55) return 'Drizzle';
  if (code <= 57) return 'Freezing drizzle';
  if (code <= 65) return 'Rain';
  if (code <= 67) return 'Freezing rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm'; // 95, 96, 99
}

export function weatherIcon(code: number, isDay = true): keyof typeof MaterialIcons.glyphMap {
  if (code === 0) return isDay ? 'wb-sunny' : 'nightlight-round';
  if (code <= 2) return 'wb-cloudy';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'foggy';
  if (code <= 57) return 'grain';
  if (code <= 67) return 'water-drop';
  if (code <= 77) return 'ac-unit';
  if (code <= 86) return 'shower';
  return 'thunderstorm';
}

// Worth warning about before a trip: anything from steady rain upward.
export function isWashout(code: number, rainChance: number): boolean {
  return code >= 61 || rainChance >= 70;
}

export function weatherTint(code: number): string {
  if (code === 0) return '#F59E0B'; // sun
  if (code <= 3) return '#64748B'; // cloud
  if (code >= 95) return '#7C3AED'; // storm
  return '#0EA5E9'; // rain
}
