import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Centralized error hook for future toast / auth redirect handling.
    return Promise.reject(error);
  },
);
