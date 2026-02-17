import axios from 'axios';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  address: Record<string, string>;
}

export async function geocode(query: string): Promise<Array<{ display_name: string; lat: number; lng: number }>> {
  try {
    const { data } = await axios.get<NominatimResult[]>(`${NOMINATIM_URL}/search`, {
      params: {
        q: query,
        format: 'json',
        limit: 5,
        addressdetails: 1,
      },
      headers: { 'User-Agent': 'AUMO-v2/2.0' },
    });

    return data.map((r) => ({
      display_name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const { data } = await axios.get<NominatimResult>(`${NOMINATIM_URL}/reverse`, {
      params: { lat, lon: lng, format: 'json' },
      headers: { 'User-Agent': 'AUMO-v2/2.0' },
    });
    return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

let debounceTimer: ReturnType<typeof setTimeout>;

export function autocomplete(
  query: string,
  callback: (results: Array<{ display_name: string; lat: number; lng: number }>) => void,
  delay = 350
): void {
  clearTimeout(debounceTimer);
  if (query.length < 3) { callback([]); return; }
  debounceTimer = setTimeout(async () => {
    const results = await geocode(query);
    callback(results);
  }, delay);
}
