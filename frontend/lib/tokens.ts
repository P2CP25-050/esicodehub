import type { AuthTokens } from '@/services/auth';

const ACCESS_KEY  = 'accessToken';
const REFRESH_KEY = 'refreshToken';

/**
 * Persist access & refresh tokens to localStorage.
 * Call this immediately after a successful login / token refresh.
 */
export function saveTokens(data: AuthTokens): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY,  data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
}

/** Read the stored access token (or null if absent). */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

/** Read the stored refresh token (or null if absent). */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

/** Remove both tokens — call on logout. */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
