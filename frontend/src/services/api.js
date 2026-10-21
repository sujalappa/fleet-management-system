import axios from "axios";
import { getToken, getActiveProjectId, clearSession } from "./auth.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5050/api"
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["x-project-id"] = getActiveProjectId();
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
