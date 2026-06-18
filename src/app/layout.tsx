import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CommandPalette } from "@/components/command/CommandPalette";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { MainLayout } from "@/components/layout/MainLayout";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unified AI CRM",
  description: "Modern CRM with AI-powered features and glassmorphism design",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <QueryProvider>
          <MainLayout>
            {children}
          </MainLayout>
          <CommandPalette />
        </QueryProvider>
      </body>
    </html>
  );
}
