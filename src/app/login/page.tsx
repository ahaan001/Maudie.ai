'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MaudieLogo } from '@/components/layout/MaudieLogo';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const INPUT =
  'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all ' +
  'bg-white text-gray-900 placeholder-gray-400 ' +
  'border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100';

const INPUT_ERROR =
  'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all ' +
  'bg-white text-gray-900 placeholder-gray-400 ' +
  'border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const justRegistered = searchParams.get('registered') === 'true';
  const prefillEmail = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      setLoading(false);

      // NextAuth v5 returns { error, status, ok, url } or null
      if (!result || result.error) {
        setAttemptCount(c => c + 1);
        setError('Incorrect email or password. Please try again.');
      } else if (result.ok) {
        router.push(callbackUrl);
        router.refresh();
      } else {
        // Fallback: check if we got a non-error URL back (success)
        setAttemptCount(c => c + 1);
        setError('Sign in failed. Please try again or reset your password.');
      }
    } catch (err) {
      setLoading(false);
      setAttemptCount(c => c + 1);
      console.error('[login] signIn error:', err);
      setError('Something went wrong. Please try again.');
    }
  }

  const showForgotHint = attemptCount >= 1;

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9fafb' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MaudieLogo height={40} />
        </div>

        {justRegistered && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm" style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46' }}>
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
            <p>Account created successfully. Sign in below to get started.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to maudie.ai</h2>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setAttemptCount(0); }}
                className={error ? INPUT_ERROR : INPUT}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Link
                  href={`/forgot-password${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
                  className="text-xs font-medium transition-colors"
                  style={{ color: '#0d9488' }}
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); setAttemptCount(0); }}
                className={error ? INPUT_ERROR : INPUT}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
                <p className="flex items-start gap-1.5 text-red-700">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </p>
                {showForgotHint && (
                  <p className="mt-1.5 text-xs text-red-600 pl-5.5">
                    If you just created an account and can&apos;t sign in,{' '}
                    <Link
                      href={`/forgot-password${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
                      className="underline font-medium"
                    >
                      reset your password here
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60"
              style={{ background: '#0d9488' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <button
                onClick={() => signIn('google', { callbackUrl })}
                className="mt-4 w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                  <path d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332Z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-semibold" style={{ color: '#0d9488' }}>
            Create one
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-gray-400">
          AI-generated content requires engineering and regulatory review before use in submissions.
        </p>
      </div>
    </div>
  );
}
