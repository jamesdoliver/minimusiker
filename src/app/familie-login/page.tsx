'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function ParentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/parent-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Show success preview for a moment
        setSuccessData(data.data);

        // Redirect to parent portal after brief delay
        setTimeout(() => {
          router.push('/familie');
        }, 1500);
      } else {
        // Check if this is a "not found" error suggesting registration
        if (response.status === 404 && data.data?.shouldRegister) {
          // Email not found - redirect to registration with email pre-filled
          const registrationUrl = `/register?email=${encodeURIComponent(data.data.email || email.trim().toLowerCase())}`;
          router.push(registrationUrl);
          return;
        }

        setError(data.error || 'Unable to log in. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      if (!successData) {
        setIsLoading(false);
      }
    }
  };

  // Show success state
  if (successData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cream-100 to-sage-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="mb-6">
              <div className="w-20 h-20 bg-sage-100 rounded-full mx-auto flex items-center justify-center">
                <svg className="w-10 h-10 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {successData.message || `Welcome back, ${successData.parent?.firstName}!`}
            </h2>

            {successData.school && (
              <p className="text-lg text-gray-600 mb-2">
                {successData.school.name}
              </p>
            )}

            {successData.event?.bookingDate && (
              <p className="text-md text-gray-500 mb-4">
                Event Date: {new Date(successData.event.bookingDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}

            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <LoadingSpinner size="sm" />
              <span>Redirecting to your portal...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-100 to-sage-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
            <span className="text-3xl">🎵</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">MiniMusiker</h1>
          <p className="text-gray-600 mt-2">School Music Event Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Your Child's Music Event
            </h2>
            <p className="text-gray-600">
              Enter your email to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="parent@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3 px-4 border border-transparent rounded-lg shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 font-button font-bold uppercase tracking-wide"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Verifying...
                </span>
              ) : (
                'Continue'
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Secure • No password required</span>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <a
                href="mailto:info@minimusiker.de?subject=Parent Portal Access"
                className="font-medium text-primary hover:text-primary/80"
              >
                Contact support
              </a>
            </p>
          </div>
        </div>

        {/* Special Offer Preview */}
        <div className="mt-6 bg-white rounded-xl shadow-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-sage-400 to-sage-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl">🎁</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">
                Special Bundle Offer Inside!
              </p>
              <p className="text-xs text-gray-600">
                Buy a t-shirt, get your school's recording FREE
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}