'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.serika.dev';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const returnUrl = searchParams.get('returnUrl') || '/';

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          router.push(returnUrl);
        }
      } catch (err) {
        // User not logged in, stay on page
      }
    };
    checkAuth();
  }, [router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Login to Serika Accounts
      const loginRes = await fetch(`${ACCOUNTS_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          rememberMe,
          productId: 'serika-art',
        }),
      });

      const loginData = await loginRes.json();

      if (!loginData.success) {
        throw new Error(loginData.error || 'Login failed');
      }

      // Step 2: Exchange the session token with our backend
      const exchangeRes = await fetch('/api/auth/exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          token: loginData.token,
        }),
      });

      const exchangeData = await exchangeRes.json();

      if (!exchangeData.success) {
        throw new Error(exchangeData.error || 'Session exchange failed');
      }

      // Step 3: Force refresh to update auth state
      window.location.href = returnUrl;
    } catch (err: any) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Serika.art
          </h1>
          <p className="text-zinc-400 mt-2">Sign in to continue</p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900 rounded-lg shadow-xl p-8 border border-zinc-800">
          <h2 className="text-2xl font-semibold text-white mb-6">Login</h2>

          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white placeholder-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
              />
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="mr-2 w-4 h-4 text-purple-600 border-zinc-700 rounded focus:ring-purple-500 bg-zinc-950 disabled:opacity-50"
                />
                <span className="text-sm text-zinc-400">Remember me</span>
              </label>
              <a
                href={`${ACCOUNTS_URL}/forgot-password`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-500 hover:text-purple-400"
              >
                Forgot password?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-900 text-zinc-500">or</span>
            </div>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-sm text-zinc-400">
              Don't have an account?{' '}
              <a
                href={`${ACCOUNTS_URL}/register`}
                className="text-purple-500 hover:text-purple-400 font-medium"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-zinc-600 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
