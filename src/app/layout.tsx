import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Корневой layout приложения. Остаётся RSC (никакого 'use client'), поэтому
// серверные секреты не утекают в клиентский бандл. Интерфейс — mobile-first:
// viewport фиксирует масштаб под ширину устройства, шрифт Geist задаётся один раз.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Список покупок",
  description: "Список покупок с автоматическим приоритетом",
};

// Mobile-first: карточки авторизации и список рассчитаны на узкий экран.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
