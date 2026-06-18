"use client";

import { useAuth } from "@/lib/auth-provider";

export function useUserId() {
  const { userId, isLoading } = useAuth();

  return { userId, isLoading };
}
