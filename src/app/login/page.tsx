'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MaudieLogo } from '@/components/layout/MaudieLogo';
import { CheckCircle2 } from 'lucide-react';

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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Incorrect email or password. Please try again.');
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9fafb' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MaudieLogo height={40} />
        </div>

        {justRegistered && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm" style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#065f46' }}>
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
            <p>Account created! Sign in below to get started.</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to maudie.ai</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                onChange={e => { setEmail(e.target.value); setError(''); }}
                className={error ? INPUT_ERROR : INPUT}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className={error ? INPUT_ERROR : INPUT}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <span>⚠</span> {error}
              </p>
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
