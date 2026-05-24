import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/app/_components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "RecallDSA",
  description: "Revise smarter. Remember longer.",
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
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#0f172a",
              color: "#fff",
              borderRadius: "14px",
            },
            success: {
              style: {
                background: "#065f46",
              },
            },
            error: {
              style: {
                background: "#991b1b",
              },
            },
          }}
        />
        <main className="w-full px-4 py-8 sm:px-6 lg:px-10 xl:px-12">
          {children}
        </main>
      </body>
    </html>
  );
}
