import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaListener } from "@/components/PwaListener";
import { SplashScreen } from "@/components/SplashScreen";
import { Suspense } from "react";
import BottomNavWrapper from "@/components/BottomNavWrapper";


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
  icons: {
    icon: "/icon.png",
    apple: "/icon-192x192.png",
  },
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

import { ReaderColorSync } from "@/components/ReaderColorSync";
import PanelManager from "@/components/PanelManager";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Evitar el flash del splash screen en navegación secundaria */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var shown = sessionStorage.getItem('bookea-splash-shown');
                  if (shown) {
                    document.documentElement.classList.add('splash-ready');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gray-50 transition-colors duration-300 dark:bg-[#0a0a0a] retro:bg-[#0d1117] navy:bg-[#0a0f1e] text-gray-900 dark:text-gray-100 retro:text-white navy:text-[#e8eaf6] flex flex-col`}
      >
        {/* 1.7 - Splash Screen HTML puro: visible instantáneamente sin esperar a React */}
        <div id="bookea-splash">
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="splash-glow" />
            <div className="splash-logo"><span>B</span>ookea</div>
            <div className="splash-sub">Tu biblioteca premium</div>
            <div className="splash-dots"><div className="splash-dot" /><div className="splash-dot" /><div className="splash-dot" /><div className="splash-dot" /><div className="splash-dot" /></div>
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
            <Header />
            <main className="flex-1 pb-[max(5rem,env(safe-area-inset-bottom))] px-safe flex flex-col">
              <Suspense fallback={null}>
                {children}
              </Suspense>
            </main>
            <BottomNavWrapper />
            <Suspense fallback={null}>
              <PanelManager />
            </Suspense>
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


