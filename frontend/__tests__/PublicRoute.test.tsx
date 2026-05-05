import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { PublicRoute } from '@/components/PublicRoute';
import * as useAuthHook from '@/context/AuthContext';
import type { AuthUser } from '@/context/AuthContext';

// ============================================================================
// Mocks
// ============================================================================

const mockReplace = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// ============================================================================
// Helpers
// ============================================================================

const studentUser: AuthUser = {
  email:      'student@esi.dz',
  first_name: 'Amine',
  last_name:  'Bensalem',
  role:       'student',
};

const professorUser: AuthUser = {
  email:      'prof@esi.dz',
  first_name: 'Karima',
  last_name:  'Moussa',
  role:       'professor',
};

const mockAuth = (overrides: Partial<ReturnType<typeof useAuthHook.useAuth>>) => {
  jest.spyOn(useAuthHook, 'useAuth').mockReturnValue({
    isLoading:       false,
    isAuthenticated: false,
    user:            null,
    setUser:         jest.fn(),
    logout:          jest.fn(),
    ...overrides,
  });
};

// ============================================================================
// Tests
// ============================================================================

describe('PublicRoute', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows the spinner while isLoading is true', () => {
    mockAuth({ isLoading: true });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    // ✅ use case-insensitive regex — matches regardless of capitalisation
    expect(screen.getByText(/checking session/i)).toBeInTheDocument();
  });

  it('does NOT render children while isLoading is true', () => {
    mockAuth({ isLoading: true });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  // ── Not authenticated ──────────────────────────────────────────────────────

  it('renders children when user is not authenticated', () => {
    mockAuth({ isLoading: false, isAuthenticated: false });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    expect(screen.getByText('Login form')).toBeInTheDocument();
  });

  it('does NOT redirect when user is not authenticated', async () => {
    mockAuth({ isLoading: false, isAuthenticated: false });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    await new Promise((r) => setTimeout(r, 100));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ── Authenticated student ──────────────────────────────────────────────────

  it('redirects student to /home', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/home')
    );
  });

  it('does NOT render children when student is authenticated', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  // ── Authenticated professor ────────────────────────────────────────────────

  it('redirects professor to /home', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: professorUser });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/home')
    );
  });

  it('does NOT render children when professor is authenticated', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: professorUser });

    render(
      <PublicRoute>
        <p>Login form</p>
      </PublicRoute>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  // ── Works for both login and register pages ────────────────────────────────

  it('renders register form when not authenticated', () => {
    mockAuth({ isLoading: false, isAuthenticated: false });

    render(
      <PublicRoute>
        <p>Register form</p>
      </PublicRoute>
    );

    expect(screen.getByText('Register form')).toBeInTheDocument();
  });

  it('redirects away from register page when already authenticated', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <PublicRoute>
        <p>Register form</p>
      </PublicRoute>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(screen.queryByText('Register form')).not.toBeInTheDocument();
  });

});