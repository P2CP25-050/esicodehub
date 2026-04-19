import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from './LoadingSpinner';

//this component is used to wrap the login 
//and register pages, preventing authenticated 
//users from accessing them. If a user is already 
//logged in and tries to access the login or register page, 
//they will be automatically redirected to their respective dashboard based on their role (professor 
// or student).

interface PublicRouteProps {
  children: React.ReactNode;
}

//component that wraps around public pages (like login/register) to prevent access by authenticated users.

// Blocks authenticated users from accessing login / register pages.
// If already logged in → redirect to the correct dashboard based on role.

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // still checking session
    if (isLoading) return;

    // Already logged in => send to the authenticated home page
    if (isAuthenticated) {
      void router.replace('/home');
    }
  }, [isLoading, isAuthenticated, router]);

  // Still verifying session
  if (isLoading) return <LoadingSpinner message="Checking session..." />;

  // Authenticated — null while redirect happens
  if (isAuthenticated) return null;

  // Not authenticated — render the public page (login / register)
  return <>{children}</>;
};
