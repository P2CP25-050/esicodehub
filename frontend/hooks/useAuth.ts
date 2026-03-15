import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  refreshToken,
} from '@/services/auth';
import {getAccessToken,getRefreshToken,clearTokens,saveTokens} from '@/lib/tokens';

//types

export interface AuthUser {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

interface UseAuthReturn {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

//hook

export const useAuth = (): UseAuthReturn => {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getRefreshToken();

    // there is no rexfresh token meanss  user is not logged in
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Refresh token exists so we verify it and get user info (if valid) or log out (if invalid/expired)
    refreshToken(token)
      .then((res) => {
        saveTokens(res.data);

        // Optionally decode user from access token or fetch profile
        // For now we just confirm the session is valid
        setIsLoading(false);
      })
      .catch(() => {
        // Refresh token is expired or invalid => clear everything
        clearTokens();
        setIsLoading(false);
      });
  }, []);

  return {
    user,
    isLoading,
    // Derived from whether an access token exists in memory
    isAuthenticated: !!getAccessToken(),
  };
};