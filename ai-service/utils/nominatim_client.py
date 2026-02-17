"""Nominatim geocoding client."""

import httpx
from typing import Dict, Any, List, Optional


NOMINATIM_URL = "https://nominatim.openstreetmap.org"
USER_AGENT = "AUMO-v2/1.0 (contact@aumo.app)"


async def geocode(address: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Forward geocoding: address → coordinates."""
    params = {
        "q": address,
        "format": "json",
        "addressdetails": 1,
        "limit": limit,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{NOMINATIM_URL}/search", params=params, headers=headers)
            response.raise_for_status()
            results = response.json()
            return [
                {
                    "lat": float(r["lat"]),
                    "lng": float(r["lon"]),
                    "display_name": r.get("display_name", ""),
                    "place_id": str(r.get("place_id", "")),
                    "type": r.get("type", ""),
                }
                for r in results
            ]
    except Exception as e:
        print(f"[Nominatim] Geocode error: {e}")
        return []


async def reverse_geocode(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """Reverse geocoding: coordinates → address."""
    params = {
        "lat": lat,
        "lon": lng,
        "format": "json",
        "addressdetails": 1,
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{NOMINATIM_URL}/reverse", params=params, headers=headers)
            response.raise_for_status()
            result = response.json()
            return {
                "lat": float(result["lat"]),
                "lng": float(result["lon"]),
                "display_name": result.get("display_name", ""),
                "place_id": str(result.get("place_id", "")),
                "address": result.get("address", {}),
            }
    except Exception as e:
        print(f"[Nominatim] Reverse geocode error: {e}")
        return None


async def autocomplete(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Search with autocomplete-style results."""
    return await geocode(query, limit=limit)
