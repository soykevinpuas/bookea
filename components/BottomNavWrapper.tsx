"use client";

import dynamic from "next/dynamic";

const BottomNav = dynamic(() => import("@/components/BottomNav").then(m => m.BottomNav), { ssr: false });

export default function BottomNavWrapper() {
  return <BottomNav />;
}
