"use client";

/**
 * Main Layout Component
 * Wraps pages with sidebar (no auth required)
 */

import { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="min-h-screen transition-all duration-300 ml-64">
        {children}
      </main>
    </div>
  );
}

export default MainLayout;
