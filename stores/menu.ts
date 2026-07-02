"use client";

import { create } from "zustand";

// Estado global del menu movil usado por layouts/paneles.
interface MobileMenuStore {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

// Store minimo para abrir/cerrar navegacion movil.
export const useMobileMenu = create<MobileMenuStore>((set) => ({
  // Estado unico compartido por botones de header y panel lateral.
  open: false,
  setOpen: (open) => set({ open }),
  // Toggle ergonomico para handlers que no necesitan conocer el valor actual.
  toggle: () => set((s) => ({ open: !s.open })),
}));
