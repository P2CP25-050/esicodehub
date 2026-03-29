/**
 * hooks/useAuth.tsx
 *
 * Provides authentication state and actions via React Context.
 *
 * Usage
 * ─────
 * 1. Wrap _app.tsx with <AuthProvider>:
 *
 *    import { AuthProvider } from "@/hooks/useAuth";
 *
 *    export default function App({ Component, pageProps }) {
 *      return (
 *        <AuthProvider>
 *          <Component {...pageProps} />
 *        </AuthProvider>
 *      );
 *    }
 *
 * 2. Call useAuth() in any component:
 *
 *    const { user, loading, login, logout } = useAuth();
 */

import {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  /** Two-letter initials shown in the header avatar, e.g. "DH" */
  avatarInitials: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Restore session on mount by hitting GET /api/auth/me */
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const data: AuthUser = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        // Network error or server down — treat as logged out
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * POST /api/auth/login  { email, password }
   * Server sets an httpOnly session cookie on success.
   * Throws an Error with a human-readable message on failure.
   */
  async function login(email: string, password: string): Promise<void> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      let message = `Login failed (${res.status})`;
      try {
        const body = await res.json();
        message = body?.message ?? message;
      } catch { /* ignore parse errors */ }
      throw new Error(message);
    }

    const data: AuthUser = await res.json();
    setUser(data);
  }

  /**
   * POST /api/auth/logout
   * Clears the session cookie server-side.
   */
  async function logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      // Always clear local state even if the request fails
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current authentication context.
 * Must be called inside a component that is a descendant of <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error(
      "[useAuth] Hook must be used inside <AuthProvider>.\n" +
      "Wrap your pages/_app.tsx with <AuthProvider> from @/hooks/useAuth."
    );
  }
  return ctx;
}