import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { brandFont } from "./fonts";
import Providers from "./components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Actalyze - AI-Powered Political Intelligence",
  description:
    "Real-time political intelligence for congressional staffers and policy professionals. Track trends, analyze districts, and stay ahead of the conversation.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${brandFont.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
