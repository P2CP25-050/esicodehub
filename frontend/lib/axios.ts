import axios from 'axios';
import { getAccessToken, saveTokens, clearTokens } from './tokens';
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});






//request interceptor to add access token to headers
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token && config.headers) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshRequest = originalRequest?.url?.includes('/auth/token/refresh/');

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !isRefreshRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refreshClient = axios.create({
          baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const response = await refreshClient.post('/auth/token/refresh/', {});

        saveTokens({ access: response.data.access });

        if (originalRequest.headers) {
          originalRequest.headers.set(
            'Authorization',
            `Bearer ${response.data.access}`
          );
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);





export default apiClient;
