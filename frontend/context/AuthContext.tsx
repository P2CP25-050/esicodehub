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

// Module-scope singleton: survives React Strict Mode remount so refresh/getMe
// are never called more than once per page load.
let _authInitPromise: Promise<AuthUser | null> | null = null;

function getAuthInitPromise(): Promise<AuthUser | null> {
  if (!_authInitPromise) {
    _authInitPromise = refreshToken()
      .then((response) => {
        saveTokens({ access: response.data.access });
        return getMe();
      })
      .then((profile) => profile.data as AuthUser)
      .catch(() => {
        clearTokens();
        // FIX: Reset so a subsequent login can re-trigger a fresh fetch
        _authInitPromise = null;
        return null;
      });
  }
  return _authInitPromise;
}

/** Resets the cached init promise. Intended for test isolation only. */
export function _resetAuthInit(): void {
  _authInitPromise = null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    getAuthInitPromise()
      .then((resolvedUser) => {
        if (!cancelled) {
          setUser(resolvedUser);
          setIsLoading(false);
        }
      })
      .catch(() => {
        // getAuthInitPromise already handles all errors internally and
        // resolves to null on failure, so this is a last-resort safety net.
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      // ignore server errors — local cleanup must always proceed
    } finally {
      // FIX: Reset singleton so the next login triggers a fresh auth check
      _authInitPromise = null;
      // Navigate BEFORE clearing state so ProtectedRoute doesn't see
      // isAuthenticated=false while still on a protected page and race us.
      router.replace('/login');
      clearTokens();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('profile_avatar_url');
      }
      setUser(null);
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