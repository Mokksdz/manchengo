'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

// Redirection par rôle après connexion
function getDefaultRoute(role: string): string {
  switch (role) {
    case 'APPRO':
      return '/dashboard/appro';
    case 'PRODUCTION':
      return '/dashboard/production';
    case 'COMMERCIAL':
      return '/dashboard/invoices';
    default:
      return '/dashboard';
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect if already authenticated - use window.location for reliable redirect
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const targetRoute = getDefaultRoute(user.role);
      // Use window.location for more reliable redirect (avoids Next.js router issues)
      window.location.href = targetRoute;
    }
  }, [isAuthenticated, authLoading, user]);

  // Show loading while checking auth status or redirecting
  if (authLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto" />
          <p className="mt-4 text-[#6E6E73]">{authLoading ? 'Vérification...' : 'Redirection...'}</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const loggedUser = await login(email, password);
      // Use window.location for reliable redirect after login (cookie needs full page reload)
      window.location.href = getDefaultRoute(loggedUser.role);
    } catch (err: unknown) {
      setError((err as Error).message || 'Erreur de connexion');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4">
            <span className="text-3xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1D1D1F]">Manchengo Smart ERP</h1>
          <p className="text-[#6E6E73] mt-1">Administration centrale</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-[16px] shadow-apple-elevated p-8">
          <h2 className="text-xl font-semibold text-[#1D1D1F] mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@manchengo.dz"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#86868B] text-sm mt-6">
          © 2024 Manchengo Smart ERP
        </p>
      </div>
    </div>
  );
}
