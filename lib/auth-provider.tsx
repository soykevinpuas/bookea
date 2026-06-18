"use client";

import { createClientClient } from "@/lib/supabase";
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";

interface AuthState {
  userId: string;
  email: string;
  isLoading: boolean;
  isReady: boolean;
}

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
  const [state, setState] = useState<AuthState>({
    userId: "",
    email: "",
    isLoading: true,
    isReady: false,
  });
  const supabase = useRef(createClientClient());

  const syncUser = useCallback(async () => {
    try {
      const { data } = await supabase.current.auth.getUser();
      const id = data.user?.id || "";
      const email = data.user?.email || "";
      if (id) {
        localStorage.setItem("bookea-auth-id", id);
      } else {
        localStorage.removeItem("bookea-auth-id");
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
        localStorage.removeItem("bookea-auth-id");
        setState({ userId: "", email: "", isLoading: false, isReady: true });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        syncUser();
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, [syncUser]);

  // Re-check auth every time the app comes to foreground
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
