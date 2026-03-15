import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';

//this component is used to wrap the login 
//and register pages, preventing authenticated 
//users from accessing them. If a user is already 
//logged in and tries to access the login or register page, 
//they will be automatically redirected to their respective dashboard based on their role (professor or student).

interface PublicRouteProps {
  children: React.ReactNode;
}

//component that wraps around public pages (like login/register) to prevent access by authenticated users.

// Blocks authenticated users from accessing login / register pages.
// If already logged in → redirect to the correct dashboard based on role.

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // still checking session
    if (isLoading) return;

    // Already logged in => send to their dashboard
    if (isAuthenticated) {
      router.replace(
        user?.role === 'professor'
          ? '/dashboard/teacher'
          : '/dashboard/student'
      );
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Still verifying session
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
          Checking session...
        </span>
      </div>
    );
  }

  // Authenticated — null while redirect happens
  if (isAuthenticated) return null;

  // Not authenticated — render the public page (login / register)
  return <>{children}</>;
};