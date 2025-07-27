import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { brandFont } from "./fonts";
import "./globals.css";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GutRoot - Gut Health, Personalized from the Root Up",
  description: "Your personalized AI-powered gut health guide for better digestion and overall wellness.",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${brandFont.variable} antialiased`}
      >
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </body>
    </html>
  );
}
