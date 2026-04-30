import * as SecureStore from "expo-secure-store";

import { API_JSON_HEADERS, getApiBaseUrl } from "@/constants/api";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: "driver" | "passenger" | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
};

const AUTH_SESSION_KEY = "ridescout.auth.session";

let authSession: AuthSession | null = null;
let refreshPromise: Promise<AuthSession | null> | null = null;

export function getAuthSession() {
  return authSession;
}

export function hasAuthSession() {
  return Boolean(authSession?.accessToken && authSession?.refreshToken);
}

export async function loadAuthSession() {
  if (authSession) return authSession;

  const stored = await SecureStore.getItemAsync(AUTH_SESSION_KEY);
  if (!stored) return null;

  try {
    authSession = JSON.parse(stored) as AuthSession;
    return authSession;
  } catch {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    authSession = null;
    return null;
  }
}

export async function setAuthSession(session: AuthSession | null) {
  authSession = session;

  if (!session) {
    await SecureStore.deleteItemAsync(AUTH_SESSION_KEY);
    return;
  }

  await SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function updateAuthUser(nextUser: Partial<AuthenticatedUser>) {
  const current = authSession ?? (await loadAuthSession());
  if (!current) return null;

  const updated = {
    ...current,
    user: {
      ...current.user,
      ...nextUser,
    },
  };

  await setAuthSession(updated);
  return updated;
}

export async function clearAuthSession() {
  await setAuthSession(null);
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function refreshAccessToken() {
  const current = authSession ?? (await loadAuthSession());
  if (!current?.refreshToken) {
    await clearAuthSession();
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      const data = await readJson<{
        accessToken: string;
        refreshToken: string;
        user: AuthenticatedUser;
      }>(response);

      if (!response.ok || !data.accessToken || !data.refreshToken || !data.user) {
        await clearAuthSession();
        return null;
      }

      const nextSession: AuthSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      };

      await setAuthSession(nextSession);
      return nextSession;
    } catch {
      await clearAuthSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options: { requiresAuth?: boolean; retryOn401?: boolean } = {},
) {
  const { requiresAuth = true, retryOn401 = true } = options;
  const session = authSession ?? (await loadAuthSession());
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  headers.set("ngrok-skip-browser-warning", "true");

  if (requiresAuth && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401 && requiresAuth && retryOn401 && session?.refreshToken) {
    const nextSession = await refreshAccessToken();
    if (!nextSession?.accessToken) {
      return response;
    }

    const retryHeaders = new Headers(init.headers || {});
    if (!retryHeaders.has("Content-Type") && init.body) {
      retryHeaders.set("Content-Type", "application/json");
    }
    retryHeaders.set("ngrok-skip-browser-warning", "true");
    retryHeaders.set("Authorization", `Bearer ${nextSession.accessToken}`);

    return fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers: retryHeaders,
    });
  }

  return response;
}
