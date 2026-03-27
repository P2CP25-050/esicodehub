import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('@/services/auth', () => ({
  refreshToken: jest.fn(),
  getMe:        jest.fn(), // ← required because useAuth calls getMe after refresh
}));

jest.mock('@/lib/tokens', () => ({
  getAccessToken:  jest.fn(),
  getRefreshToken: jest.fn(),
  clearTokens:     jest.fn(),
  saveTokens:      jest.fn(),
}));

jest.mock('next/router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

import * as authService from '@/services/auth';
import * as tokenLib    from '@/lib/tokens';

// ============================================================================
// Helpers
// ============================================================================

// default getMe mock — used in all successful refresh tests
const mockGetMeSuccess = () => {
  (authService.getMe as jest.Mock).mockResolvedValue({
    data: {
      email:      'a@esi.dz',
      first_name: 'Amine',
      last_name:  'Bensalem',
      role:       'student',
    },
  });
};

// ============================================================================
// Tests
// ============================================================================

describe('useAuth', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('starts with isLoading = true', () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('some-token');
    (authService.refreshToken as jest.Mock).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(true);
  });

  // ── No refresh token ───────────────────────────────────────────────────────

  it('sets isLoading = false when no refresh token exists', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('returns isAuthenticated = false when no refresh token exists', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue(null);
    (tokenLib.getAccessToken  as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('does NOT call refreshToken when no refresh token exists', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue(null);

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });
  });

  // ── Successful refresh ─────────────────────────────────────────────────────

  it('calls refreshToken when a refresh token exists', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('valid-refresh-token');
    (authService.refreshToken as jest.Mock).mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
    });
    mockGetMeSuccess();

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });
  });

  it('calls saveTokens with the new tokens on successful refresh', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('valid-refresh-token');
    (authService.refreshToken as jest.Mock).mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
    });
    mockGetMeSuccess();

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(tokenLib.saveTokens).toHaveBeenCalledWith({
        access:  'new-access',
        refresh: 'new-refresh',
      });
    });
  });

  it('sets isLoading = false after successful refresh', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('valid-refresh-token');
    (authService.refreshToken as jest.Mock).mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
    });
    mockGetMeSuccess();

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('returns isAuthenticated = true after successful refresh', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('valid-refresh-token');
    (authService.refreshToken as jest.Mock).mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
    });
    // ✅ getMe must resolve so setIsAuthenticated(true) is reached
    mockGetMeSuccess();
    (tokenLib.getAccessToken as jest.Mock).mockReturnValue('new-access');

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('calls getMe after successful refresh', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('valid-refresh-token');
    (authService.refreshToken as jest.Mock).mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
    });
    mockGetMeSuccess();

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(authService.getMe).toHaveBeenCalled();
    });
  });

  it('sets user after successful getMe call', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('valid-refresh-token');
    (authService.refreshToken as jest.Mock).mockResolvedValue({
      data: { access: 'new-access', refresh: 'new-refresh' },
    });
    mockGetMeSuccess();

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user).toEqual({
      email:      'a@esi.dz',
      first_name: 'Amine',
      last_name:  'Bensalem',
      role:       'student',
    });
  });

  // ── Failed refresh ─────────────────────────────────────────────────────────

  it('calls clearTokens when refresh fails', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('expired-token');
    (authService.refreshToken as jest.Mock).mockRejectedValue(new Error('401'));

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(tokenLib.clearTokens).toHaveBeenCalled();
    });
  });

  it('sets isLoading = false after failed refresh', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('expired-token');
    (authService.refreshToken as jest.Mock).mockRejectedValue(new Error('401'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('returns isAuthenticated = false after failed refresh', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('expired-token');
    (authService.refreshToken as jest.Mock).mockRejectedValue(new Error('401'));
    (tokenLib.getAccessToken  as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('does NOT call saveTokens when refresh fails', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('expired-token');
    (authService.refreshToken as jest.Mock).mockRejectedValue(new Error('401'));

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(tokenLib.saveTokens).not.toHaveBeenCalled();
    });
  });

  it('does NOT call getMe when refresh fails', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue('expired-token');
    (authService.refreshToken as jest.Mock).mockRejectedValue(new Error('401'));

    renderHook(() => useAuth());

    await waitFor(() => expect(tokenLib.clearTokens).toHaveBeenCalled());
    expect(authService.getMe).not.toHaveBeenCalled();
  });

  // ── Return shape ───────────────────────────────────────────────────────────

  it('always returns user, isLoading, isAuthenticated', async () => {
    (tokenLib.getRefreshToken as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current).toHaveProperty('user');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isAuthenticated');
  });

});