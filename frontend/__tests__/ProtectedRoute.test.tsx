import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import * as useAuthHook from '@/hooks/useAuth';
import type { AuthUser } from '@/hooks/useAuth';

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
    ...overrides,
  });
};

// ============================================================================
// Tests
// ============================================================================

describe('ProtectedRoute', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows the spinner while isLoading is true', () => {
    mockAuth({ isLoading: true });

    render(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>
    );

    // ✅ match exactly what LoadingSpinner renders — check your component's message prop
    expect(screen.getByText(/verifying session/i)).toBeInTheDocument();
  });

  it('does NOT render children while isLoading is true', () => {
    mockAuth({ isLoading: true });

    render(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  // ── Unauthenticated ────────────────────────────────────────────────────────

  it('redirects to /login when not authenticated', async () => {
    mockAuth({ isLoading: false, isAuthenticated: false });

    render(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/login')
    );
  });

  it('does NOT render children when not authenticated', async () => {
    mockAuth({ isLoading: false, isAuthenticated: false });

    render(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument();
  });

  // ── Authenticated — no role restriction ───────────────────────────────────

  it('renders children when authenticated with no allowedRole set', () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>
    );

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });

  it('does NOT redirect when authenticated with no allowedRole set', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <ProtectedRoute>
        <p>Secret content</p>
      </ProtectedRoute>
    );

    await new Promise((r) => setTimeout(r, 100));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ── Correct role ───────────────────────────────────────────────────────────

  it('renders children when student accesses student page', () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <ProtectedRoute allowedRole="student">
        <p>Student page</p>
      </ProtectedRoute>
    );

    expect(screen.getByText('Student page')).toBeInTheDocument();
  });

  it('renders children when professor accesses professor page', () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: professorUser });

    render(
      <ProtectedRoute allowedRole="professor">
        <p>Teacher page</p>
      </ProtectedRoute>
    );

    expect(screen.getByText('Teacher page')).toBeInTheDocument();
  });

  // ── Wrong role ─────────────────────────────────────────────────────────────

  it('redirects professor to /assignments when accessing student page', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: professorUser });

    render(
      <ProtectedRoute allowedRole="student">
        <p>Student only</p>
      </ProtectedRoute>
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/assignments')
    );
  });

  it('redirects student to /assignments when accessing professor page', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: studentUser });

    render(
      <ProtectedRoute allowedRole="professor">
        <p>Professor only</p>
      </ProtectedRoute>
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('/assignments')
    );
  });

  it('does NOT render children when user has wrong role', async () => {
    mockAuth({ isLoading: false, isAuthenticated: true, user: professorUser });

    render(
      <ProtectedRoute allowedRole="student">
        <p>Student only</p>
      </ProtectedRoute>
    );

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(screen.queryByText('Student only')).not.toBeInTheDocument();
  });

});