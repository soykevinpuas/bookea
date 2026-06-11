"use client";

import { create } from "zustand";

interface MobileMenuStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useMobileMenu = create<MobileMenuStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
