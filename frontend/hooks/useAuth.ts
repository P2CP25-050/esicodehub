import { useState, useEffect } from 'react';
import {
  getAccessToken,
  getRefreshToken,
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
  const [user ,setUser]           = useState<AuthUser | null>(null);   // we will need it in the future inchallah
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);//now it is not derived from memory 
  useEffect(() => {
    const token = getRefreshToken();

    // we used async function inside useEffect because the refreshToken call is async and we want to await it.
    const checkSession = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await refreshToken(token);
        saveTokens(res.data);
        const profile = await getMe();
        setUser(profile.data);
        //those we will be using tjhem later
        setIsAuthenticated(!!getAccessToken());
      } catch {

        clearTokens();
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        // always runs  whether success or fail
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