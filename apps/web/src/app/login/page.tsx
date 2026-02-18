'use client';

import { useState, useEffect } from 'react';
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
  const currentYear = new Date().getFullYear();
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
      <div className="silicon-shell min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#E5E5EA] border-t-[#EC7620] mx-auto" />
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
      if (loggedUser?.role) {
        window.location.href = getDefaultRoute(loggedUser.role);
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de connexion';
      setError(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="silicon-shell min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[18px] mb-4 border border-white/70 bg-white/70 backdrop-blur-[18px] shadow-[0_12px_28px_rgba(18,22,33,0.08),inset_0_1px_0_rgba(255,255,255,0.45)]">
            <div
              className="w-10 h-10 rounded-[12px] flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
                boxShadow: '0 2px 8px rgba(29, 29, 31, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              <span className="text-[18px] font-bold text-white">M</span>
            </div>
          </div>
          <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] text-[#1D1D1F]">Manchengo Smart ERP</h1>
          <p className="text-[#6E6E73] mt-1">Administration centrale</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8">
          <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-6 tracking-[-0.02em]">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 rounded-[12px] text-sm bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]">
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
              className="w-full btn-amber py-3 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#86868B] text-sm mt-6">
          © {currentYear} Manchengo Smart ERP
        </p>
      </div>
    </div>
  );
}
