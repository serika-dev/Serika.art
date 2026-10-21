'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, Mail, Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AuthShell, authInputClass, authButtonClass, authIconClass } from '@/components/AuthShell';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.serika.dev';

function LoginForm() {
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
    <AuthShell title="Welcome Back" subtitle="Sign in with your Serika account">
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="relative">
          <div className={authIconClass}><Mail /></div>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            placeholder="Email address"
            aria-label="Email address"
            className={authInputClass}
          />
        </div>

        <div className="relative">
          <div className={authIconClass}><Lock /></div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            placeholder="Password"
            aria-label="Password"
            className={authInputClass}
          />
        </div>

        <label htmlFor="remember" className="flex cursor-pointer select-none items-center gap-3 text-sm text-gray-300">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
            disabled={loading}
            className="rounded-[4px] border-gray-600"
          />
          Remember me for 30 days
        </label>

        <button type="submit" disabled={loading} className={authButtonClass}>
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Signing in…
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-6 space-y-4 text-center text-sm">
        <a
          href={`${ACCOUNTS_URL}/forgot-password`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-violet-400 transition-colors hover:text-violet-300"
        >
          Forgot Password?
        </a>
        <p className="text-gray-300">
          Need an account?{' '}
          <a href={`${ACCOUNTS_URL}/register`} className="font-semibold text-white hover:text-violet-300">
            Sign up
          </a>
        </p>
        <p className="text-xs text-gray-500">
          By signing in you agree to our{' '}
          <a href="https://serika.dev/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Terms</a> and{' '}
          <a href="https://serika.dev/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-300">Privacy Policy</a>.
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
