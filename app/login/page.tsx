'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

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
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            Serika.art
          </h1>
          <p className="text-muted-foreground mt-2">Sign in to continue</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="you@example.com"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={loading}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <a
                  href={`${ACCOUNTS_URL}/forgot-password`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>

          <div className="px-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
          </div>

          <CardFooter className="flex justify-center pt-6">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <a
                href={`${ACCOUNTS_URL}/register`}
                className="text-primary hover:underline font-medium"
              >
                Sign up
              </a>
            </p>
          </CardFooter>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/70 mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
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
