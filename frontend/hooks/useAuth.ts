import { useState, useEffect } from 'react';
import {
  clearTokens,
  saveTokens,
} from '@/lib/tokens';
import { refreshToken, getMe } from '@/services/auth';

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

//hooks
export const useAuth = (): UseAuthReturn => 
  {
  const [user ,setUser]           = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await refreshToken();
        saveTokens({ access: res.data.access });
        const profile = await getMe();
        setUser(profile.data);
        setIsAuthenticated(true);
      } catch {

        clearTokens();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated,
  };
};