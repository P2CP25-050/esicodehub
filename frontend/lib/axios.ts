import axios from 'axios';
import {getAccessToken,getRefreshToken,saveTokens,clearTokens} from "./tokens";
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
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

    if (
      error.response?.status === 401 &&
      getRefreshToken() &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const refresh = getRefreshToken();

           const refreshClient = axios.create({
             baseURL: process.env.NEXT_PUBLIC_API_URL,
             });

            const response = await refreshClient.post(
            "/auth/token/refresh/",
            { refresh }
            );

        saveTokens(response.data);

        if (originalRequest.headers) {
        originalRequest.headers.set(
        "Authorization",
        `Bearer ${response.data.access}`
  );
}

        return apiClient(originalRequest);
      } catch (refreshError) {
        //  Refresh failed
        clearTokens();

        //  Redirect to login
        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);





export default apiClient;
