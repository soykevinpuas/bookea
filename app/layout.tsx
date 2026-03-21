import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers";
import { Header } from "@/components/Header";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PwaListener } from "@/components/PwaListener";

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

// 1.6 - RootLayout: Proveedores de estado, tostadas y tema global
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white transition-colors duration-300 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <PwaListener />
          <QueryProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
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

