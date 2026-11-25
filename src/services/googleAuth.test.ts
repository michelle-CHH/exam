import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';

// Mock firebase/auth and firebase/app before importing googleAuth
const mockSignOut = vi.fn().mockResolvedValue(undefined);
const mockSignInWithPopup = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn().mockReturnValue({}),
  getApps: vi.fn().mockReturnValue([]),
}));

vi.mock('firebase/auth', () => {
  class MockGoogleAuthProvider {
    addScope = vi.fn();
    static credentialFromResult = vi.fn();
  }

  return {
    getAuth: vi.fn().mockReturnValue({ currentUser: null }),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    signInWithPopup: (...args: unknown[]) => mockSignInWithPopup(...args),
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
    GoogleAuthProvider: MockGoogleAuthProvider,
  };
});

describe('googleAuth service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('manages in-memory cached access token', async () => {
    const { getAccessToken, setCachedAccessToken } = await import('./googleAuth');

    setCachedAccessToken('mock-token-abc');
    expect(await getAccessToken()).toBe('mock-token-abc');

    setCachedAccessToken(null);
    expect(await getAccessToken()).toBeNull();
  });

  it('clears token on logoutGoogle', async () => {
    const { getAccessToken, logoutGoogle, setCachedAccessToken } = await import('./googleAuth');

    setCachedAccessToken('active-token');
    await logoutGoogle();

    expect(mockSignOut).toHaveBeenCalled();
    expect(await getAccessToken()).toBeNull();
  });

  it('initializes auth state listener and calls callbacks on user state changes', async () => {
    const { initAuth, setCachedAccessToken } = await import('./googleAuth');
    const onAuthSuccess = vi.fn();
    const onAuthFailure = vi.fn();

    let authStateCallback: ((user: User | null) => void) | undefined;
    mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
      authStateCallback = cb;
      return vi.fn(); // unsubscribe function
    });

    initAuth(onAuthSuccess, onAuthFailure);
    expect(mockOnAuthStateChanged).toHaveBeenCalled();

    // Simulate logged in user
    setCachedAccessToken('user-token');
    const mockUser = { uid: 'user-1', email: 'test@example.com' } as unknown as User;
    if (authStateCallback) {
      await authStateCallback(mockUser);
    }
    expect(onAuthSuccess).toHaveBeenCalledWith(mockUser, 'user-token');

    // Simulate logged out user
    if (authStateCallback) {
      await authStateCallback(null);
    }
    expect(onAuthFailure).toHaveBeenCalled();
  });

  it('signs in with popup and caches returned access token', async () => {
    const { googleSignIn, getAccessToken } = await import('./googleAuth');
    const { GoogleAuthProvider } = await import('firebase/auth');
    const mockUser = { uid: 'u123', email: 'u@example.com' };

    mockSignInWithPopup.mockResolvedValueOnce({
      user: mockUser,
      credential: { accessToken: 'popup-token' },
    });

    (GoogleAuthProvider.credentialFromResult as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      accessToken: 'popup-token',
    });

    const result = await googleSignIn();

    expect(result).toEqual({ user: mockUser, accessToken: 'popup-token' });
    expect(await getAccessToken()).toBe('popup-token');
  });
});
