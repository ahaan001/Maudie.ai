'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { MaudieLogo } from '@/components/layout/MaudieLogo';
import { AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

const INPUT =
  'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all ' +
  'bg-white text-gray-900 placeholder-gray-400 ' +
  'border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100';

const INPUT_ERROR =
  'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all ' +
  'bg-white text-gray-900 placeholder-gray-400 ' +
  'border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100';

type Step = 'form' | 'success';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  function clearFieldError(field: string) {
    if (fieldErrors[field]) {
      setFieldErrors(e => ({ ...e, [field]: '' }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError('');

    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = 'Email is required.';
    if (!newPassword) errors.newPassword = 'New password is required.';
    else if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters.';
    if (!confirmPassword) errors.confirmPassword = 'Please confirm your password.';
    else if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        } else {
          setGlobalError(data.error ?? 'Failed to reset password. Please try again.');
        }
        setLoading(false);
        return;
      }

      setStep('success');
      setLoading(false);
    } catch {
      setGlobalError('Something went wrong. Please check your connection and try again.');
      setLoading(false);
    }
  }

  async function handleSignIn() {
    setSigningIn(true);
    const result = await signIn('credentials', {
      email: email.trim().toLowerCase(),
      password: newPassword,
      redirect: false,
    });

    if (!result?.error) {
      router.push('/dashboard');
    } else {
      // Sign-in failed even after reset — redirect to login so they can try manually
      router.push(`/login?email=${encodeURIComponent(email.trim())}`);
    }
    setSigningIn(false);
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9fafb' }}>
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <MaudieLogo height={40} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#ecfdf5' }}>
                <CheckCircle2 className="h-6 w-6" style={{ color: '#10b981' }} />
              </div>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Password updated</h2>
            <p className="text-sm text-gray-500 mb-6">
              Your password has been reset successfully. You can now sign in with your new password.
            </p>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60"
              style={{ background: '#0d9488' }}
            >
              {signingIn ? 'Signing in…' : 'Sign in now'}
            </button>
            <p className="mt-3 text-sm text-gray-500">
              or{' '}
              <Link href="/login" className="font-medium" style={{ color: '#0d9488' }}>
                go to login page
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9fafb' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MaudieLogo height={40} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>

          <h2 className="text-lg font-semibold text-gray-900 mb-1">Reset your password</h2>
          <p className="text-sm text-gray-500 mb-6">
            Enter your account email and choose a new password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); clearFieldError('email'); }}
                className={fieldErrors.email ? INPUT_ERROR : INPUT}
                placeholder="you@company.com"
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); clearFieldError('newPassword'); clearFieldError('confirmPassword'); }}
                className={fieldErrors.newPassword ? INPUT_ERROR : INPUT}
                placeholder="Min. 8 characters"
              />
              {fieldErrors.newPassword && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {fieldErrors.newPassword}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                className={fieldErrors.confirmPassword ? INPUT_ERROR : INPUT}
                placeholder="Repeat your new password"
              />
              {fieldErrors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" /> {fieldErrors.confirmPassword}
                </p>
              )}
            </div>

            {globalError && (
              <div className="rounded-lg px-3 py-2.5 text-sm flex items-start gap-2" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}>
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{globalError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-white text-sm font-semibold rounded-lg transition-opacity disabled:opacity-60 mt-2"
              style={{ background: '#0d9488' }}
            >
              {loading ? 'Resetting password…' : 'Reset password'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: '#0d9488' }}>
              Create one
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          AI-generated content requires engineering and regulatory review before use in submissions.
        </p>
      </div>
    </div>
  );
}
