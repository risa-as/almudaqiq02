import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "نظام البيان - إدارة شاملة",
  description: "نظام متكامل لإدارة المبيعات والمخزون والمحاسبة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} antialiased`}
        style={{ fontFamily: 'var(--font-cairo, Cairo), Arial, sans-serif', background: 'var(--bg-page)' }}
      >
        <Toaster position="top-center" toastOptions={{
          style: { fontFamily: 'inherit', fontWeight: 'bold' }
        }} />
        {children}
      </body>
    </html>
  );
}
