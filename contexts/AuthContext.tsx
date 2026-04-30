import { router } from "expo-router";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { detectBackendPort } from "@/constants/api";
import {
  apiFetch,
  AuthSession,
  AuthenticatedUser,
  clearAuthSession,
  getAuthSession,
  loadAuthSession,
  setAuthSession,
  updateAuthUser,
} from "@/services/api";

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthenticatedUser | null;
  isRestoring: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string }) => Promise<AuthSession>;
  completeRoleSelection: (role: "driver" | "passenger") => Promise<AuthSession>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSessionState] = useState<AuthSession | null>(getAuthSession());
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    detectBackendPort().catch(() => console.warn("Port detection failed"));
    loadAuthSession()
      .then((stored) => {
        setSessionState(stored);
      })
      .finally(() => setIsRestoring(false));
  }, []);

  const login = async ({ email, password }: { email: string; password: string }) => {
    await detectBackendPort();
    const response = await apiFetch(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      { requiresAuth: false, retryOn401: false },
    );

    const data = await readJson<{
      message?: string;
      accessToken?: string;
      refreshToken?: string;
      user?: AuthenticatedUser;
    }>(response);

    if (!response.ok || !data.accessToken || !data.refreshToken || !data.user) {
      throw new Error(data.message || "Login failed");
    }

    const nextSession: AuthSession = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    };

    await setAuthSession(nextSession);
    setSessionState(nextSession);
    return nextSession;
  };

  const completeRoleSelection = async (role: "driver" | "passenger") => {
    const current = getAuthSession() ?? session;
    if (!current?.user?.id) {
      throw new Error("Missing user info. Please login again.");
    }

    const response = await apiFetch("/api/auth/role", {
      method: "PATCH",
      body: JSON.stringify({ userId: current.user.id, role }),
    });

    const data = await readJson<{
      message?: string;
      accessToken?: string;
      user?: AuthenticatedUser;
    }>(response);

    if (!response.ok || !data.user) {
      throw new Error(data.message || "Role update failed");
    }

    const updatedSession = await updateAuthUser({ role: data.user.role });
    const nextSession: AuthSession = {
      accessToken: data.accessToken || updatedSession?.accessToken || current.accessToken,
      refreshToken: updatedSession?.refreshToken || current.refreshToken,
      user: {
        ...current.user,
        ...data.user,
      },
    };

    await setAuthSession(nextSession);
    setSessionState(nextSession);
    return nextSession;
  };

  const logout = async () => {
    const current = getAuthSession() ?? session;

    try {
      if (current?.user?.id) {
        await apiFetch("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ userId: current.user.id }),
        });
      }
    } catch {
      // Prefer clearing local auth even if remote logout fails.
    } finally {
      await clearAuthSession();
      setSessionState(null);
      router.replace("/");
    }
  };

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      isRestoring,
      isAuthenticated: Boolean(session?.accessToken && session?.user),
      login,
      completeRoleSelection,
      logout,
    }),
    [isRestoring, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
