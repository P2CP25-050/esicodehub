import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import * as authService from '@/services/auth';
import * as tokensLib from '@/lib/tokens';

// ============================================================================
// Mocks
// ============================================================================

const mockPush = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/services/auth', () => ({
  refreshToken: jest.fn(),
  getMe: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('@/lib/tokens', () => ({
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  getAccessToken: jest.fn(),
}));

// ============================================================================
// Helpers
// ============================================================================

const mockedRefreshToken = authService.refreshToken as jest.Mock;
const mockedGetMe = authService.getMe as jest.Mock;
const mockedLogout = authService.logout as jest.Mock;
const mockedSaveTokens = tokensLib.saveTokens as jest.Mock;
const mockedClearTokens = tokensLib.clearTokens as jest.Mock;

const testUser = {
  email:      'student@esi.dz',
  first_name: 'Amine',
  last_name:  'Bensalem',
  role:       'student' as const,
};

/** Renders AuthProvider with a consumer that exposes auth state via data-testid. */
function AuthConsumer() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  return (
    <>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
      <button onClick={logout}>Logout</button>
    </>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

// ============================================================================
// Tests
// ============================================================================

describe('AuthProvider', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Initial loading state ──────────────────────────────────────────────────

  it('starts with isLoading=true before auth resolves', () => {
    // Never-resolving promise keeps the component in its loading state.
    mockedRefreshToken.mockReturnValue(new Promise(() => {}));

    renderWithProvider();

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('email')).toHaveTextContent('none');
  });

  // ── Successful refresh + getMe ─────────────────────────────────────────────

  it('sets user and isLoading=false after successful refresh and getMe', async () => {
    mockedRefreshToken.mockResolvedValue({ data: { access: 'access-token' } });
    mockedGetMe.mockResolvedValue({ data: testUser });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('email')).toHaveTextContent('student@esi.dz');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(mockedSaveTokens).toHaveBeenCalledWith({ access: 'access-token' });
    expect(mockedGetMe).toHaveBeenCalledTimes(1);
  });

  // ── Failed refresh ─────────────────────────────────────────────────────────

  it('clears user and sets isLoading=false when refreshToken fails', async () => {
    mockedRefreshToken.mockRejectedValue(new Error('Unauthorized'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(mockedClearTokens).toHaveBeenCalled();
    expect(mockedSaveTokens).not.toHaveBeenCalled();
    expect(mockedGetMe).not.toHaveBeenCalled();
  });

  // ── Failed getMe ───────────────────────────────────────────────────────────

  it('clears user and sets isLoading=false when getMe fails after successful refresh', async () => {
    mockedRefreshToken.mockResolvedValue({ data: { access: 'access-token' } });
    mockedGetMe.mockRejectedValue(new Error('Server error'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(mockedClearTokens).toHaveBeenCalled();
  });

  // ── logout() ──────────────────────────────────────────────────────────────

  it('clears state and redirects to /login on logout', async () => {
    mockedRefreshToken.mockResolvedValue({ data: { access: 'access-token' } });
    mockedGetMe.mockResolvedValue({ data: testUser });
    mockedLogout.mockResolvedValue({});

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('email')).toHaveTextContent('student@esi.dz');

    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click();
    });

    expect(mockedLogout).toHaveBeenCalledTimes(1);
    expect(mockedClearTokens).toHaveBeenCalled();
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('still clears state and redirects even if logout API call throws', async () => {
    mockedRefreshToken.mockResolvedValue({ data: { access: 'access-token' } });
    mockedGetMe.mockResolvedValue({ data: testUser });
    mockedLogout.mockRejectedValue(new Error('Network error'));

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click();
    });

    expect(mockedClearTokens).toHaveBeenCalled();
    expect(screen.getByTestId('email')).toHaveTextContent('none');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

});
