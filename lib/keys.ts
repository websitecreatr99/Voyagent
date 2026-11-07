import type { ApiKeys, ServiceId } from "./api";

export const EMPTY_KEYS: ApiKeys = { groq: "", tavily: "", aviationstack: "", openweather: "" };

const STORAGE_KEY = "voyagent.apiKeys";

export interface KeyField {
  id: keyof ApiKeys;
  service: ServiceId;
  label: string;
  powers: string;
  placeholder: string;
  getUrl: string;
}

/** Which key powers which part of the pipeline (mirrors the backend's keys.py). */
export const KEY_FIELDS: KeyField[] = [
  {
    id: "groq",
    service: "llm",
    label: "Groq",
    powers: "AI planning: supervisor, budget, itinerary, final plan",
    placeholder: "gsk_…",
    getUrl: "https://console.groq.com/keys",
  },
  {
    id: "aviationstack",
    service: "flights",
    label: "AviationStack",
    powers: "Flight data: airports and airlines",
    placeholder: "aviationstack access key",
    getUrl: "https://aviationstack.com/dashboard",
  },
  {
    id: "tavily",
    service: "hotels",
    label: "Tavily",
    powers: "Hotel and area search",
    placeholder: "tvly-…",
    getUrl: "https://app.tavily.com",
  },
  {
    id: "openweather",
    service: "weather",
    label: "OpenWeather",
    powers: "Current weather and forecast",
    placeholder: "OpenWeather API key",
    getUrl: "https://home.openweathermap.org/api_keys",
  },
];

export const SERVICE_LABEL: Record<ServiceId, string> = {
  llm: "AI planning (Groq)",
  flights: "Flights (AviationStack)",
  hotels: "Hotels (Tavily)",
  weather: "Weather (OpenWeather)",
};

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Load keys: localStorage if the user chose "remember", otherwise this tab's sessionStorage. */
export function loadKeys(): { keys: ApiKeys; remember: boolean } {
  const fromLocal = safe(() => localStorage.getItem(STORAGE_KEY), null);
  const raw = fromLocal ?? safe(() => sessionStorage.getItem(STORAGE_KEY), null);
  if (!raw) return { keys: EMPTY_KEYS, remember: false };
  const parsed = safe(() => JSON.parse(raw), {});
  return { keys: { ...EMPTY_KEYS, ...parsed }, remember: fromLocal !== null };
}

export function saveKeys(keys: ApiKeys, remember: boolean) {
  const value = JSON.stringify(keys);
  const empty = !Object.values(keys).some((v) => v.trim());
  safe(() => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (empty) return;
    (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, value);
  }, undefined);
}

export function hasAnyKey(keys: ApiKeys) {
  return Object.values(keys).some((v) => v.trim());
}
