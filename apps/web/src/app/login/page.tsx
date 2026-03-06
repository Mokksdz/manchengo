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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const currentYear = new Date().getFullYear();
  const router = useRouter();
  const { login, user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      const targetRoute = getDefaultRoute(user.role);
      router.replace(targetRoute);
    }
  }, [isAuthenticated, authLoading, user, router]);

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
        router.replace(getDefaultRoute(loggedUser.role));
      } else {
        router.replace('/dashboard');
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
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
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
