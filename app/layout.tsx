import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aplikasi Keuangan",
  description: "Sistem pencatatan keuangan",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-gray-900 text-gray-100 flex flex-col items-center min-h-screen p-4 antialiased">
        {children}
      </body>
    </html>
  );
}