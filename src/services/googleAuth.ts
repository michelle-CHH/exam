import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
// 優先從環境變數 (NEXT_PUBLIC_FIREBASE_*) 讀取配置，若無則備援讀取本地 JSON
function resolveFirebaseConfig() {
  const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (envApiKey) {
    return {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      apiKey: envApiKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      oAuthClientId: process.env.NEXT_PUBLIC_FIREBASE_OAUTH_CLIENT_ID || '',
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../firebase-applet-config.json');
  } catch {
    return {};
  }
}

export const firebaseConfig = resolveFirebaseConfig();

// Initialize Firebase App instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Configure Google Auth Provider with Google Sheets & Drive scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/drive.readonly');

// In-memory token storage (DO NOT store in localStorage or sessionStorage per security guidelines)
let cachedAccessToken: string | null = null;

/**
 * Initialize Firebase Auth state listener.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) {
        onAuthSuccess(user, cachedAccessToken);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) {
        onAuthFailure();
      }
    }
  });
};

/**
 * Sign in with Google using popup and obtain access token
 * 支援 Firebase signInWithPopup 以及 Google Identity Services (GIS) 雙重自動容錯，
 * 解決在 localhost 或非授權網域下觸發的 auth/unauthorized-domain 錯誤。
 */
export const googleSignIn = async (): Promise<{ user: User | null; accessToken: string } | null> => {
  try {
    // 1. 優先嘗試 Firebase Auth
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        return { user: result.user, accessToken: cachedAccessToken };
      }
    } catch (fbErr: unknown) {
      // 若為 unauthorized-domain 或 popup-blocked，切換至 Google Identity Services (GIS)
      const errObj = fbErr as { code?: string; message?: string };
      console.warn('Firebase Auth popup failed, attempting Google Identity Services (GIS):', errObj?.code || errObj?.message);
      if (errObj?.code === 'auth/unauthorized-domain' || errObj?.code === 'auth/popup-blocked' || errObj?.code === 'auth/operation-not-allowed') {
        const gisToken = await requestAccessTokenViaGis();
        if (gisToken) {
          cachedAccessToken = gisToken;
          return { user: auth.currentUser, accessToken: gisToken };
        }
      }
      throw fbErr;
    }

    return null;
  } catch (error: unknown) {
    console.error('Google Sign-in failed:', error);
    throw error;
  }
};

interface GisTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken: () => void;
}

interface GisWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (resp: GisTokenResponse) => void;
          error_callback?: (err: { message?: string }) => void;
        }) => GisTokenClient;
      };
    };
  };
}

/**
 * 透過 Google Identity Services (GIS) 直接向 Google 取得 OAuth2 Access Token
 * 繞過 Firebase 控制台的 Authorized Domains 限制
 */
export const requestAccessTokenViaGis = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('未配置 Google oAuthClientId');
  }

  const gisWin = window as unknown as GisWindow;

  // 動態加載 GIS SDK
  if (typeof gisWin.google?.accounts?.oauth2 === 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('google-gis-sdk');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('無法載入 Google 驗證 SDK')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'google-gis-sdk';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('無法載入 Google 驗證 SDK (accounts.google.com/gsi/client)'));
      document.head.appendChild(script);
    });
  }

  return new Promise((resolve, reject) => {
    try {
      const google = gisWin.google;
      if (!google?.accounts?.oauth2) {
        throw new Error('Google Identity Services SDK 未就緒');
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
        callback: (resp: GisTokenResponse) => {
          if (resp.error) {
            reject(new Error(resp.error_description || resp.error));
          } else if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            reject(new Error('未取得有效 Google Access Token'));
          }
        },
        error_callback: (err: { message?: string }) => {
          reject(new Error(err?.message || 'Google 授權視窗已被關閉或取消'));
        },
      });
      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Get current in-memory access token
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Set in-memory access token manually if refreshed
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Log out
 */
export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
