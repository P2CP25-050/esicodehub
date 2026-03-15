import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

//types

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'student' | 'professor';
}

//component

export const ProtectedRoute = ({
  children,
  allowedRole,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Still checking session — don't redirect yet
    if (isLoading) return;

    // Not logged in => send to login
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Logged in but wrong role → send to their own dashboard
    if (allowedRole && user?.role !== allowedRole) {
      router.replace(
        user?.role === 'professor'
          ? '/dashboard/teacher'
          : '/dashboard/student'
      );
    }
  }, [isLoading, isAuthenticated, user, allowedRole, router]);

  // show spinner (for the whole page since we don't know if they can access it or not yet)
   if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050c1a',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid rgba(59,130,246,.15)',
          borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite',
        }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{
          color: '#475569',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '.75rem',
          letterSpacing: '.1em',
        }}>
          Verifying session...
        </span>
      </div>
    );
  }

  // Not authenticated — null while redirect happens
  if (!isAuthenticated) return null;

  // Wrong role — null while redirect happens
  if (allowedRole && user?.role !== allowedRole) return null;

  // All checks passed — render the page
  return <>{children}</>;
};