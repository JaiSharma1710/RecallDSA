import type { Metadata } from "next";
import { Navbar } from "@/app/_components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSA Revision Helper",
  description: "Track solved DSA questions and revise weak areas daily.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-950">
        <Navbar />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
