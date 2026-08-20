import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('fleetnexus_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fleetnexus_token');
      localStorage.removeItem('fleetnexus_user');
    }
    return Promise.reject(error);
  },
);
