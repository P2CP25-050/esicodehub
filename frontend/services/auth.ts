import axios, { type AxiosInstance } from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '@/lib/tokens';

// --- Types -------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'professor' | 'student';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// --- Axios instance ----------------------------------------------------------

const apiKey = process.env.NEXT_PUBLIC_API_KEY;
if (!apiKey) {
  console.warn('[auth] NEXT_PUBLIC_API_KEY is not set — requests will be rejected by the backend.');
}

export const api: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey ?? '',
  },
  timeout: 10_000,
});

// --- Request interceptor: attach Bearer token --------------------------------

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// --- Response interceptor: silent token refresh on 401 ----------------------

let isRefreshing = false;
let queue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
  queue.forEach((resolve) => resolve(newToken));
  queue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Only attempt refresh on 401; never retry the refresh call itself
    if (error.response?.status !== 401 || original._retry || original.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        queue.push((token: string) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          resolve(api(original));
        });
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const res = await axios.post<AuthTokens>(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
        { refreshToken: getRefreshToken() },
        { headers: { 'X-API-Key': apiKey ?? '' } },
      );
      saveTokens(res.data);
      processQueue(res.data.accessToken);
      original.headers['Authorization'] = `Bearer ${res.data.accessToken}`;
      return api(original);
    } catch {
      clearTokens();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

// --- Auth endpoints ----------------------------------------------------------

/** POST /auth/login */
export const login = (payload: LoginPayload) =>
  api.post<AuthTokens>('/auth/login', payload);

/** POST /auth/refresh */
export const refreshToken = (token: string) =>
  api.post<AuthTokens>('/auth/refresh', { refreshToken: token });

/** POST /auth/logout */
export const logout = () =>
  api.post('/auth/logout', { refreshToken: getRefreshToken() });