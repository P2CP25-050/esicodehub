import apiClient from '@/lib/axios';

//interfaces
export interface RegisterRequest {
  email: string;
  password: string;
  password_confirm: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthUser {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

//functions

//validation and auth flows
export const register = (data: RegisterRequest) =>
  apiClient.post('/auth/register/', data);

//verify email with code sent to user's email
export const verifyEmail = (data: VerifyEmailRequest) =>
  apiClient.post('/auth/verify-email/', data);

//resend verification code to user's email
export const resendVerification = (data: ResendVerificationRequest) =>
  apiClient.post('/auth/resend-verification/', data);

//login and get tokens
export const login = (data: LoginRequest) =>
  apiClient.post<LoginResponse>('/auth/login/', data);
//refresh access token using refresh token
export const refreshToken = (refresh: string) =>
  apiClient.post<AuthTokens>('/auth/token/refresh/', { refresh });


// Store tokens in memory only — never localStorage
let accessToken: string | null = null;
let storedRefreshToken: string | null = null;

export const saveTokens = (tokens: AuthTokens) => {
  accessToken = tokens.access;
  storedRefreshToken = tokens.refresh;
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => storedRefreshToken;

export const clearTokens = () => {
  accessToken = null;
  storedRefreshToken = null;
};

//request interceptor to add access token to headers
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

//response interceptor to handle 401 errors and attempt token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and we have a refresh token, try to refresh
    // Prevent infinite loops by checking if this is already a refresh attempt
    if (
      error.response?.status === 401 &&
      getRefreshToken() &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const storedRefresh = getRefreshToken();
        if (!storedRefresh) {
          clearTokens();
          return Promise.reject(error);
        }

        const response = await apiClient.post<AuthTokens>(
          '/auth/token/refresh/',
          { refresh: storedRefresh }
        );
        saveTokens(response.data);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${getAccessToken()}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and let request fail
        clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
