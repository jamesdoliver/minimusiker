'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface RegisterCTACardProps {
  onRegisterClick: () => void;
}

export default function RegisterCTACard({ onRegisterClick }: RegisterCTACardProps) {
  const t = useTranslations('registration.page');
  const router = useRouter();

  // Login section state
  const [showLoginSection, setShowLoginSection] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Basic email validation
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const response = await fetch('/api/auth/parent-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Successfully logged in - redirect to familie portal
        router.push('/familie');
      } else if (response.status === 404) {
        // Email not found
        setLoginError(t('loginNotFound'));
      } else {
        // Other error
        setLoginError(data.error || t('loginError'));
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError(t('loginError'));
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="bg-[#f0efec] rounded-2xl p-6 md:p-8 shadow-sm h-full flex flex-col justify-center">
      <h2 className="font-heading text-2xl md:text-3xl font-bold text-[#6b8a85] mb-4">
        {t('registerCardTitle')}
      </h2>

      <p className="text-gray-600 text-lg mb-6">
        {t('registerCardSubtitle')}
      </p>

      <button
        onClick={onRegisterClick}
        className="w-full py-3 px-4 rounded-lg shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all font-button font-bold uppercase tracking-wide"
      >
        {t('registerCardCta')}
      </button>

      {/* Already Registered? Toggle Link */}
      <button
        type="button"
        onClick={() => setShowLoginSection(!showLoginSection)}
        className="mt-4 flex items-center justify-center gap-2 text-sm text-[#6b8a85] hover:text-[#5a7974] transition-colors mx-auto"
      >
        <span>{t('alreadyRegistered')}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${showLoginSection ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible Login Section */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          showLoginSection ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-white/50 rounded-lg p-4 border border-gray-200">
            <form onSubmit={handleLoginSubmit} className="space-y-3">
              {loginError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
                  {loginError}
                </div>
              )}

              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[#6b8a85] mb-1">
                  {t('loginEmail')}
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="familie@minimusiker.de"
                  className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500 transition-colors text-sm"
                  disabled={loginLoading}
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || !isValidEmail(loginEmail)}
                className="w-full py-2 px-4 rounded-lg text-white bg-[#6b8a85] hover:bg-[#5a7974] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6b8a85] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm"
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner size="sm" className="border-white" />
                    <span>{t('loginButton')}...</span>
                  </span>
                ) : (
                  t('loginButton')
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
