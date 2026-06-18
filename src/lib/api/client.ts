/**
 * Axios API Client with Bearer Token Interceptor
 * Configured for Match-Trade Broker API
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

// Use basePath for same-origin requests (Backend Proxy pattern)
// API routes in /api/* handle Match-Trade API calls server-side to avoid CORS
// Must match next.config.ts basePath for proper routing
const API_BASE_URL = "/ai-crm";

/**
 * Create configured Axios instance
 */
function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 120000, // 2 minutes for large customer list loads
  });

  // Request interceptor to add Bearer token
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      // Get token from localStorage (client-side only)
      if (typeof window !== "undefined") {
        const authStorage = localStorage.getItem("auth-storage");
        if (authStorage) {
          try {
            const parsed = JSON.parse(authStorage) as { state?: { token?: string } };
            const token = parsed?.state?.token;
            if (token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          } catch {
            // Invalid JSON in storage, ignore
          }
        }
      }
      return config;
    },
    (error: unknown) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error)) {
        // Handle 401 Unauthorized - clear auth and redirect to login
        if (error.response?.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth-storage");
            window.location.href = "/ai-crm/login";
          }
        }
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const apiClient: AxiosInstance = createApiClient();

export default apiClient;
