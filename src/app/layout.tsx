import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/app/cyberpunk.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SoundFlow — Collaborate on Music, Together",
  description: "Async workspace for music bands. Centralized idea management, project tracking, and precise audio feedback with timestamped comments.",
  keywords: ["SoundFlow", "music collaboration", "band workspace", "audio feedback", "music production"],
  authors: [{ name: "SoundFlow Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "SoundFlow — Collaborate on Music, Together",
    description: "Async workspace for music bands. Manage ideas, projects, and collaborate on tracks with precise timestamped feedback.",
    siteName: "SoundFlow",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
