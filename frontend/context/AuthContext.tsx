import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
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

// Pages where auth should NOT be checked (avoids 2 API calls on public pages)
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some(
      (p) => router.pathname === p || router.pathname.startsWith(p + '/')
    );

    if (isPublic) {
      setIsLoading(false);
      return;
    }

    // HttpOnly cookie is sent automatically — no token argument needed
    refreshToken()
      .then((tokens) => {
        saveTokens(tokens.data); // saves access token in memory for Axios interceptor
        return getMe();
      })
      .then((userData) => setUser(userData.data))
      .catch(() => {
        clearTokens();
        // Don't redirect here — ProtectedRoute handles the redirect
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array — MUST be empty. This runs once on app mount only.

  const logout = useCallback(async () => {
    try {
      await logoutApi(); // calls backend to clear the HttpOnly cookie
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
  if (!ctx)
    throw new Error(
      'useAuth must be used within AuthProvider — wrap your app in _app.tsx'
    );
  return ctx;
}