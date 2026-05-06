import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaListener } from "@/components/PwaListener";
import { SplashScreen } from "@/components/SplashScreen";
import { BottomNav } from "@/components/BottomNav";
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
        <style
          dangerouslySetInnerHTML={{
            __html: `
              /* 1.7 - Splash Screen puro CSS: se muestra ANTES de que React cargue */
              #bookea-splash {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #0a0a0a;
                transition: opacity 0.6s ease-out, visibility 0.6s ease-out;
              }
              #bookea-splash.splash-hide {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
              }
              #bookea-splash .splash-logo {
                font-size: clamp(3rem, 10vw, 5rem);
                font-weight: 900;
                letter-spacing: -0.05em;
                color: white;
                opacity: 1;
                transform: translateY(0) scale(1);
                animation: splashFadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s backwards;
              }
              #bookea-splash .splash-logo span { color: #3b82f6; }
              #bookea-splash .splash-sub {
                font-size: 0.75rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.4em;
                color: rgba(96, 165, 250, 0.7);
                margin-top: 1rem;
                opacity: 1;
                animation: splashFadeIn 0.8s ease 0.5s backwards;
              }
              #bookea-splash .splash-bar {
                margin-top: 2rem;
                width: 12rem;
                height: 2px;
                background: rgba(255,255,255,0.1);
                border-radius: 9999px;
                overflow: hidden;
              }
              #bookea-splash .splash-bar-fill {
                height: 100%;
                background: #3b82f6;
                box-shadow: 0 0 15px rgba(59,130,246,0.5);
                transform: translateX(0);
                animation: splashProgress 1.8s ease-in-out 0.3s backwards;
              }
              #bookea-splash .splash-glow {
                position: absolute;
                width: 200px;
                height: 200px;
                background: rgba(37, 99, 235, 0.15);
                border-radius: 50%;
                filter: blur(80px);
                animation: splashPulse 2s ease-in-out infinite alternate;
              }
              @keyframes splashFadeIn {
                from { opacity: 0; transform: translateY(20px) scale(0.95); }
              }
              @keyframes splashProgress {
                from { transform: translateX(-100%); }
              }
              @keyframes splashPulse {
                from { transform: scale(0.8); opacity: 0.1; }
                to { transform: scale(1.4); opacity: 0.2; }
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-[#0a0a0a] retro:bg-[#0d1117] navy:bg-[#0a0f1e] text-gray-900 dark:text-gray-100 retro:text-white navy:text-[#e8eaf6] flex flex-col`}
      >
        {/* 1.7 - Splash Screen HTML puro: visible instantáneamente sin esperar a React */}
        <div id="bookea-splash">
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="splash-glow" />
            <div className="splash-logo"><span>B</span>ookea</div>
            <div className="splash-sub">Tu biblioteca premium</div>
            <div className="splash-bar"><div className="splash-bar-fill" /></div>
          </div>
        </div>

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
            <main className="flex-1 pb-safe px-safe flex flex-col">
              <Suspense fallback={null}>
                {children}
              </Suspense>
            </main>
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

