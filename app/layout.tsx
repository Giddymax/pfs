import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { RegisterSW } from "@/components/register-sw";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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
    <html lang="en" className={`${plexSans.variable} h-full antialiased`}>
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
