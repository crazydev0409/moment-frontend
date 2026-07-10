import axios from 'axios';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
export const http = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});
export const mapApiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
