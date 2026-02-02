'use client';

// ═══════════════════════════════════════════════════════════════════════════
// AUTH CONTEXT - Secure httpOnly Cookie Authentication
// ═══════════════════════════════════════════════════════════════════════════
// SECURITY:
// - NO localStorage or sessionStorage usage
// - Tokens stored in httpOnly cookies (not accessible via JS)
// - Automatic token refresh via cookies
// - XSS protection guaranteed
// ═══════════════════════════════════════════════════════════════════════════

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth, User } from './api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Listen for session-expired events from apiFetch (replaces window.location.href)
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      router.push('/login');
    };
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [router]);

  /**
   * Refresh user data from server
   * Uses httpOnly cookie for authentication automatically
   */
  const refreshUser = useCallback(async () => {
    try {
      const userData = await auth.me();
      setUser(userData);
    } catch {
      setUser(null);
    }
  }, []);

  /**
   * Check auth on mount
   * The httpOnly cookie is sent automatically with credentials: 'include'
   */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try to get current user - if cookie is valid, this will work
        const userData = await auth.me();
        setUser(userData);
      } catch {
        // No valid session - user needs to login
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  /**
   * Login - server sets httpOnly cookies
   * We only store user info in state (no tokens in JS)
   */
  const login = async (email: string, password: string): Promise<User> => {
    const response = await auth.login(email, password);
    setUser(response.user);
    return response.user;
  };

  /**
   * Logout - server clears all httpOnly cookies
   */
  const logout = async () => {
    try {
      await auth.logout();
    } catch {
      // Ignore errors - we're logging out anyway
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
