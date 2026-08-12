import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/register-sw";
// Self-hosted (see app/globals.css for why — not fetched from Google's CDN
// at build time). Every weight/style used anywhere in the app is imported
// once here since this layout wraps every route.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-sans/400-italic.css";
import "@fontsource/ibm-plex-sans/500-italic.css";
import "@fontsource/ibm-plex-sans/600-italic.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prime Financial Service",
  description: "Client, savings, susu, loan and repayment management for Prime Financial Service",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PFS",
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
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="min-h-full flex flex-col bg-[#F3F3F4] text-[#0A2240]" suppressHydrationWarning>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
