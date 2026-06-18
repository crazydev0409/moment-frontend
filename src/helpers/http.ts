import axios from 'axios';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
export const http = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});
export const uploadPath = 'http://10.0.2.2:3000/uploads/';
// export const uploadPath = 'https://hotel-booking-backend-splu.onrender.com/uploads/';
export const mapApiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
