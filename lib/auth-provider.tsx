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
const getCachedId = () => (typeof window !== "undefined" ? localStorage.getItem(CACHE_KEY) || "" : "");

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
    const cachedId = getCachedId();
    return {
      userId: cachedId,
      email: "",
      isLoading: !!cachedId,
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
      } else {
        localStorage.removeItem(CACHE_KEY);
      }
      setState({ userId: id, email, isLoading: false, isReady: true });
    } catch {
      setState({ userId: "", email: "", isLoading: false, isReady: true });
    }
  }, []);

  useEffect(() => {
    syncUser();

    const { data: listener } = supabase.current.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(CACHE_KEY);
        setState({ userId: "", email: "", isLoading: false, isReady: true });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncUser();
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, [syncUser]);

  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === "visible") {
        syncUser();
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [syncUser]);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}
