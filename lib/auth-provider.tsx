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

  const syncUser = useCallback(async () => {
    try {
      const { data } = await supabase.current.auth.getUser();
      const id = data.user?.id || "";
      const email = data.user?.email || "";
      if (id) {
        localStorage.setItem(CACHE_KEY, id);
        localStorage.setItem(EMAIL_CACHE_KEY, email);
      } else {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(EMAIL_CACHE_KEY);
      }
      setState({ userId: id, email, isLoading: false, isReady: true });
    } catch {
      // Network error — keep last known state
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Fast path: getSession() lee cookies localmente, SIN request de red
    supabase.current.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user;
      if (sessionUser) {
        const id = sessionUser.id;
        const email = sessionUser.email || "";
        localStorage.setItem(CACHE_KEY, id);
        localStorage.setItem(EMAIL_CACHE_KEY, email);
        setState({ userId: id, email, isLoading: false, isReady: true });
      } else {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(EMAIL_CACHE_KEY);
        setState({ userId: "", email: "", isLoading: false, isReady: true });
      }
    }).catch(() => {
      setState({ userId: "", email: "", isLoading: false, isReady: true });
    });

    // Slow path: getUser() verifica con el server (refresca token si expiró)
    syncUser();

    const { data: listener } = supabase.current.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(EMAIL_CACHE_KEY);
        setState({ userId: "", email: "", isLoading: false, isReady: true });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncUser();
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, [syncUser]);

  // Re-check auth cada vez que la app vuelve a primer plano (solo lectura local)
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") {
        supabase.current.auth.getSession().then(({ data }) => {
          const sessionUser = data.session?.user;
          if (sessionUser) {
            const id = sessionUser.id;
            const email = sessionUser.email || "";
            localStorage.setItem(CACHE_KEY, id);
            localStorage.setItem(EMAIL_CACHE_KEY, email);
            setState({ userId: id, email, isLoading: false, isReady: true });
          }
        }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}
