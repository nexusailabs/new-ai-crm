"use client";

/**
 * Auth Guard Component
 * Protects routes from unauthorized access
 * Redirects to login if user is not authenticated
 */

import { useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";

interface AuthGuardProps {
  children: ReactNode;
}

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/login"];

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Skip auth check for public routes
    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (!isAuthenticated && !isPublicRoute) {
      // Redirect to login if not authenticated
      router.push("/login");
    }

    if (isAuthenticated && pathname === "/login") {
      // Redirect to dashboard if already authenticated and on login page
      router.push("/");
    }
  }, [isAuthenticated, pathname, router]);

  // Show nothing while checking auth
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return <>{children}</>;
}

export default AuthGuard;
