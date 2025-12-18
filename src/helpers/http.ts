import axios from 'axios';

export const http = axios.create({
  // baseURL: "https://hotel-booking-backend-splu.onrender.com/api",
  baseURL: "https://moment-backend-production.up.railway.app/api",
  // baseURL: "http://10.0.2.2:3000/api",
  headers: {
    'Content-Type': 'application/json',
  },
});
export const uploadPath = 'http://10.0.2.2:3000/uploads/';
// export const uploadPath = 'https://hotel-booking-backend-splu.onrender.com/uploads/';
export const mapApiKey = process.env.PLACE_API_KEY;