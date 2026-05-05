import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'student' | 'professor';
}

export const ProtectedRoute = ({
  children,
  allowedRole,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Still checking session — don't redirect yet
    if (isLoading) return;

    // FIX: Not logged in => send to login page, NOT the landing page
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    // Logged in but wrong role -> send to a valid app page
    if (allowedRole && user?.role !== allowedRole) {
      router.replace('/assignments');
    }
  }, [isLoading, isAuthenticated, user, allowedRole, router]);

  // Show spinner while session is being verified
  if (isLoading) return <LoadingSpinner message="verifying session" />;

  // Not authenticated — render nothing while redirect happens
  if (!isAuthenticated) return null;

  // Wrong role — render nothing while redirect happens
  if (allowedRole && user?.role !== allowedRole) return null;

  // All checks passed — render the page
  return <>{children}</>;
};