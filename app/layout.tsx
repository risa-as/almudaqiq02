import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "نظام المدقق",
  description: "نظام متكامل لإدارة المبيعات والمخزون والمحاسبة",
  icons: {
    icon: [
      { url: "/logo.ico", type: "image/x-icon", sizes: "64x64" },
      { url: "/favicon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/logo.ico" type="image/x-icon" sizes="64x64" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* Anti-flash: apply saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();` }} />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: "'Cairo', Arial, sans-serif", background: 'var(--bg-page)' }}
      >
        <Toaster position="top-center" toastOptions={{
          style: { fontFamily: 'inherit', fontWeight: 'bold' }
        }} />
        {children}
      </body>
    </html>
  );
}
