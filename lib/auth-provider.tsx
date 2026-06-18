"use client";

import { createClientClient } from "@/lib/supabase";
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";

interface AuthState {
  userId: string;
  isLoading: boolean;
  isReady: boolean;
}

const AuthContext = createContext<AuthState>({
  userId: "",
  isLoading: true,
  isReady: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    userId: "",
    isLoading: true,
    isReady: false,
  });
  const supabase = useRef(createClientClient());
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const cachedId = typeof window !== "undefined" ? localStorage.getItem("bookea-auth-id") || "" : "";

    supabase.current.auth.getUser().then(({ data }) => {
      const id = data.user?.id || "";
      if (id) {
        localStorage.setItem("bookea-auth-id", id);
      } else {
        localStorage.removeItem("bookea-auth-id");
      }
      setState({ userId: id || cachedId, isLoading: false, isReady: true });
    }).catch(() => {
      setState({ userId: cachedId, isLoading: false, isReady: true });
    });

    const { data: listener } = supabase.current.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem("bookea-auth-id");
        setState({ userId: "", isLoading: false, isReady: true });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        supabase.current.auth.getUser().then(({ data }) => {
          const id = data.user?.id || "";
          if (id) localStorage.setItem("bookea-auth-id", id);
          setState({ userId: id, isLoading: false, isReady: true });
        });
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  );
}
