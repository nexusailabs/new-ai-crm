/**
 * Authentication Store
 * Zustand store for managing authentication state
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthStore, User, LoginCredentials } from "@/types";

const initialState = {
  token: "auto-auth-token",
  user: null,
  isAuthenticated: true, // Auto-authenticated - no login required
  isLoading: false,
  error: null,
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      ...initialState,

      login: (credentials: LoginCredentials): void => {
        set({
          token: credentials.token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      },

      logout: (): void => {
        set({
          ...initialState,
        });
      },

      setUser: (user: User | null): void => {
        set({ user });
      },

      setError: (error: string | null): void => {
        set({ error, isLoading: false });
      },

      clearError: (): void => {
        set({ error: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  return useAuthStore((state) => state.isAuthenticated);
}

/**
 * Hook to get current user
 */
export function useCurrentUser(): User | null {
  return useAuthStore((state) => state.user);
}

/**
 * Hook to get auth token
 */
export function useAuthToken(): string | null {
  return useAuthStore((state) => state.token);
}

export default useAuthStore;
