import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

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
          ? '/dashboard/professor'
          : '/dashboard/student'
      );
    }
  }, [isLoading, isAuthenticated, user, allowedRole, router]);

  // show spinner (for the whole page since we don't know if they can access it or not yet)
   if (isLoading) return <LoadingSpinner message="verifying session"/>

  // Not authenticated — null while redirect happens
  if (!isAuthenticated) return null;

  // Wrong role — null while redirect happens
  if (allowedRole && user?.role !== allowedRole) return null;

  // All checks passed — render the page
  return <>{children}</>;
};