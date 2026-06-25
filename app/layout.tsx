import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { InstallPrompt } from "@/components/install-prompt";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

// Stanbic Bank's corporate typeface is Benton Sans (licensed); IBM Plex Sans is
// the closest freely-licensed match — a clean, corporate grotesque with the same
// wide weight range.
const plexSans = IBM_Plex_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Prime Financial Service",
  description: "Client, savings, susu, loan and repayment management for Prime Financial Service",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PrimeFS",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#177245",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexSans.variable} h-full antialiased`}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* eslint-disable-next-line @next/next/no-head-element */}
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[#F3F3F4] text-[#0A2240]" suppressHydrationWarning>
        {children}
        <InstallPrompt />
        <RegisterSW />
      </body>
    </html>
  );
}
