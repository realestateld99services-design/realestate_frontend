import axios from "axios";

// Target local backend port
const API_BASE_URL = "http://localhost:3000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Auto append Authorization headers
apiClient.interceptors.request.use((config: any) => {
  const token = localStorage.getItem("real_estate_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
