import axios from "axios";

// Target local backend port in development, or live server in production
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : "/api"
);

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Auto append Authorization headers
apiClient.interceptors.request.use((config: any) => {
  const token = sessionStorage.getItem("real_estate_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
