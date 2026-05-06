import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaListener } from "@/components/PwaListener";
import { SplashScreen } from "@/components/SplashScreen";
import { BottomNav } from "@/components/BottomNav";
import { PageTransitionWrapper } from "@/components/PageTransitionWrapper";
import { Suspense } from "react";


// 1.5 - Configuración de fuentes y Metadata global
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bookea",
  description: "Tu biblioteca premium de E-books",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bookea",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

import { Toaster } from "sonner";

import { createClient } from "@/lib/server";
import { ReaderColorSync } from "@/components/ReaderColorSync";

// 1.6 - RootLayout: Proveedores de estado, tostadas y tema global
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  // 1.6.1 - Manejo defensivo: getUser hace un fetch de red al servidor de Supabase.
  // Si falla (proyecto pausado, red, vars de entorno), la app debe seguir funcionando
  // mostrando el Header en estado "no logueado" en lugar de romper todo el layout.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    console.warn("⚠️ Layout: No se pudo obtener el usuario del servidor:", err);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const shown = sessionStorage.getItem('bookea-splash-shown');
                  if (!shown) {
                    document.documentElement.classList.add('splash-pending');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .splash-pending body {
                opacity: 0 !important;
                visibility: hidden !important;
              }
              .splash-ready body {
                opacity: 1 !important;
                visibility: visible !important;
                transition: opacity 0.5s ease-in;
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-[#0a0a0a] retro:bg-[#0d1117] navy:bg-[#0a0f1e] text-gray-900 dark:text-gray-100 retro:text-white navy:text-[#e8eaf6] flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          themes={["light", "dark", "retro", "navy"]}
        >
          <ReaderColorSync />
          <PwaListener />
          <SplashScreen />
          <QueryProvider>
            <Header initialUser={user ? { id: user.id, email: user.email } : null} />
            <PageTransitionWrapper>
              <main className="flex-1 pb-safe px-safe flex flex-col">
                <Suspense fallback={null}>
                  {children}
                </Suspense>
              </main>
            </PageTransitionWrapper>
            <BottomNav />
          </QueryProvider>
          <Toaster 
            position="bottom-right" 
            richColors 
            theme="system" 
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

