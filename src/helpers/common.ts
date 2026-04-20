import axios from "axios";

export const getPlacesByQuery = async (query: string, apiKey: string) => {
  try {
    // Use Places API (New) — Text Search
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
      }
    );
    // Map to the same shape the rest of the app expects (legacy Places API format)
    return (response.data.places || []).map((place: any) => ({
      place_id: place.id,
      name: place.displayName?.text || '',
      formatted_address: place.formattedAddress || '',
      geometry: place.location
        ? { location: { lat: place.location.latitude, lng: place.location.longitude } }
        : undefined,
    }));
  } catch (error: any) {
    console.error('[Places API] request failed:', error.response?.data || error.message);
    return [];
  }
};