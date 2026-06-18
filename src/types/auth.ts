/**
 * Authentication Types for Match-Trade API
 */

export interface User {
  uuid: string;
  email: string;
  name: string | null;
}

export interface Token {
  accessToken: string;
  expiresAt?: string;
}

export interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  token: string;
}

export interface AuthActions {
  login: (credentials: LoginCredentials) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export type AuthStore = AuthState & AuthActions;
