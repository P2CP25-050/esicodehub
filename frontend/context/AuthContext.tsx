import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { useRouter } from 'next/router';
import { refreshToken, getMe, logout as logoutApi } from '@/services/auth';
import { saveTokens, clearTokens } from '@/lib/tokens';

export interface AuthUser {
  email: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'professor';
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    let cancelled = false;

    refreshToken()
      .then((response) => {
        saveTokens({ access: response.data.access });
        return getMe();
      })
      .then((profile) => {
        if (!cancelled) setUser(profile.data);
      })
      .catch(() => {
        if (!cancelled) {
          clearTokens();
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // ignore server errors — local cleanup must always proceed
    } finally {
      clearTokens();
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider — wrap your app in _app.tsx'
    );
  }

  return ctx;
}