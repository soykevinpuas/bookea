"use client";

import { createClientClient } from "@/lib/supabase";
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";

interface AuthState {
  userId: string;
  email: string;
  isLoading: boolean;
  isReady: boolean;
}

const CACHE_KEY = "bookea-auth-id";
const EMAIL_CACHE_KEY = "bookea-auth-email";
const AUTH_RECOVERY_GRACE_MS = 10000;
const AUTH_COOKIE_RECOVERY_GRACE_MS = 1500;
const SESSION_KEEPALIVE_MS = 5 * 60 * 1000;
const INITIAL_SERVER_VERIFY_DELAY_MS = 900;
type SessionUser = { id: string; email?: string | null } | null | undefined;

const AuthContext = createContext<AuthState>({
  userId: "",
  email: "",
  isLoading: true,
  isReady: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === "undefined") {
      return { userId: "", email: "", isLoading: true, isReady: false };
    }

    return {
      userId: localStorage.getItem(CACHE_KEY) || "",
      email: localStorage.getItem(EMAIL_CACHE_KEY) || "",
      isLoading: true,
      isReady: false,
    };
  });
  const supabase = useRef(createClientClient());
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimer.current) {
      clearTimeout(recoveryTimer.current);
      recoveryTimer.current = null;
    }
  }, []);

  const clearAuthState = useCallback(() => {
    clearRecoveryTimer();
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(EMAIL_CACHE_KEY);
    setState({ userId: "", email: "", isLoading: false, isReady: true });
  }, [clearRecoveryTimer]);

  const keepLastKnownAuth = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false, isReady: true }));
  }, []);

  const waitForCookieRecovery = useCallback(() => {
    setState({ userId: "", email: "", isLoading: true, isReady: false });
  }, []);

  const applySessionUser = useCallback((sessionUser: SessionUser) => {
    if (sessionUser) {
      clearRecoveryTimer();
      const id = sessionUser.id;
      const email = sessionUser.email || "";
      localStorage.setItem(CACHE_KEY, id);
      localStorage.setItem(EMAIL_CACHE_KEY, email);
      setState({ userId: id, email, isLoading: false, isReady: true });
    } else {
      clearAuthState();
    }
  }, [clearAuthState, clearRecoveryTimer]);

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await supabase.current.auth.refreshSession();
      if (data.session?.user) {
        applySessionUser(data.session.user);
        return true;
      }
    } catch {
      // La recuperacion por getUser/getSession decide si se conserva el cache local.
    }

    return false;
  }, [applySessionUser]);

  const confirmMissingSession = useCallback(async () => {
    recoveryTimer.current = null;

    try {
      const { data: sessionData } = await supabase.current.auth.getSession();
      if (sessionData.session?.user) {
        applySessionUser(sessionData.session.user);
        return;
      }

      const refreshed = await refreshSession();
      if (refreshed) return;

      const { data: userData, error } = await supabase.current.auth.getUser();
      if (userData.user) {
        applySessionUser(userData.user);
        return;
      }

      if (error && typeof navigator !== "undefined" && !navigator.onLine) {
        keepLastKnownAuth();
        return;
      }

      clearAuthState();
    } catch {
      keepLastKnownAuth();
    }
  }, [applySessionUser, clearAuthState, keepLastKnownAuth, refreshSession]);

  const handleMissingSession = useCallback(() => {
    const cachedUserId = localStorage.getItem(CACHE_KEY);
    if (!cachedUserId) {
      waitForCookieRecovery();
      if (!recoveryTimer.current) {
        recoveryTimer.current = setTimeout(() => {
          confirmMissingSession();
        }, AUTH_COOKIE_RECOVERY_GRACE_MS);
      }
      return;
    }

    keepLastKnownAuth();

    if (!recoveryTimer.current) {
      recoveryTimer.current = setTimeout(() => {
        confirmMissingSession();
      }, AUTH_RECOVERY_GRACE_MS);
    }
  }, [confirmMissingSession, keepLastKnownAuth, waitForCookieRecovery]);

  const loadInitialSession = useCallback(async () => {
    try {
      const { data } = await supabase.current.auth.getSession();
      if (data.session?.user) {
        applySessionUser(data.session.user);
      } else {
        handleMissingSession();
      }
    } catch {
      keepLastKnownAuth();
    }
  }, [applySessionUser, handleMissingSession, keepLastKnownAuth]);

  const syncUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.current.auth.getUser();
      if (data.user) {
        applySessionUser(data.user);
        return;
      }

      if (error && typeof navigator !== "undefined" && !navigator.onLine) {
        keepLastKnownAuth();
        return;
      }

      const refreshed = await refreshSession();
      if (refreshed) return;

      handleMissingSession();
    } catch {
      // Network error — keep last known state
      keepLastKnownAuth();
    }
  }, [applySessionUser, handleMissingSession, keepLastKnownAuth, refreshSession]);

  useEffect(() => {
    let cancelled = false;
    // Fast path: getSession() lee cookies localmente, SIN request de red
    queueMicrotask(() => {
      if (!cancelled) loadInitialSession();
    });

    // Slow path: getUser() verifica con el server sin competir con el primer render.
    const verifyTimer = setTimeout(() => {
      if (!cancelled) void syncUser();
    }, INITIAL_SERVER_VERIFY_DELAY_MS);

    const { data: listener } = supabase.current.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearAuthState();
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session?.user) {
          applySessionUser(session.user);
        } else {
          syncUser();
        }
      } else if (event === "INITIAL_SESSION") {
        if (session?.user) {
          applySessionUser(session.user);
        } else {
          handleMissingSession();
        }
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(verifyTimer);
      listener?.subscription?.unsubscribe();
      clearRecoveryTimer();
    };
  }, [applySessionUser, clearAuthState, clearRecoveryTimer, handleMissingSession, loadInitialSession, syncUser]);

  // Re-check auth cada vez que la app vuelve a primer plano (solo lectura local)
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") {
        void refreshSession().then(async (recovered) => {
          await loadInitialSession();
          if (!recovered) await syncUser();
        });
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [loadInitialSession, refreshSession, syncUser]);

  useEffect(() => {
    window.addEventListener("online", syncUser);
    return () => window.removeEventListener("online", syncUser);
  }, [syncUser]);

  useEffect(() => {
    if (!state.userId) return;

    const interval = setInterval(() => {
      void refreshSession();
    }, SESSION_KEEPALIVE_MS);

    return () => clearInterval(interval);
  }, [refreshSession, state.userId]);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}
