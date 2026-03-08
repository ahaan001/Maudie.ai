'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaudieLogo } from '@/components/layout/MaudieLogo';
import { AlertCircle } from 'lucide-react';

type FieldKey = 'name' | 'email' | 'password' | 'orgName';

const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Full name',
  email: 'Email',
  password: 'Password',
  orgName: 'Organization name',
};

function inputClass(error: boolean): string {
  const base =
    'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all ' +
    'bg-white text-gray-900 placeholder-gray-400 ';
  return error
    ? base + 'border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : base + 'border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100';
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<Record<FieldKey, string>>({
    name: '',
    email: '',
    password: '',
    orgName: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [globalError, setGlobalError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(key: FieldKey, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    // Clear field error as user types
    if (fieldErrors[key]) {
      setFieldErrors(e => ({ ...e, [key]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError('');
    setFieldErrors({});

    // Client-side: catch obviously empty required fields before hitting the network
    const clientErrors: Partial<Record<FieldKey, string>> = {};
    if (!form.name.trim()) clientErrors.name = 'Full name is required.';
    if (!form.email.trim()) clientErrors.email = 'Email is required.';
    if (!form.password) clientErrors.password = 'Password is required.';
    else if (form.password.length < 8) clientErrors.password = 'Password must be at least 8 characters.';
    if (!form.orgName.trim()) clientErrors.orgName = 'Organization name is required.';

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        // Server returned field-level errors
        if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
          // If only the email field errored with "already in use", surface a CTA too
          if (res.status === 409) {
            setGlobalError('already_in_use');
          }
        } else {
          setGlobalError(data.error ?? 'Registration failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Registration succeeded — auto sign in
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (!result?.error) {
        // Happy path: signed in, go to dashboard
        router.push('/dashboard');
      } else {
        // Account was created but sign-in failed (e.g. session setup issue).
        // Redirect to login with a success banner so the user can sign in manually.
        router.push('/login?registered=true');
      }
    } catch {
      setGlobalError('Something went wrong. Please check your connection and try again.');
      setLoading(false);
    }
  }

  const fields: { key: FieldKey; type: string; autoComplete: string; placeholder: string; hint?: string }[] = [
    { key: 'name', type: 'text', autoComplete: 'name', placeholder: 'Jane Smith' },
    { key: 'email', type: 'email', autoComplete: 'email', placeholder: 'jane@company.com' },
    {
      key: 'password',
      type: 'password',
      autoComplete: 'new-password',
      placeholder: 'Min. 8 characters',
      hint: 'At least 8 characters.',
    },
    { key: 'orgName', type: 'text', autoComplete: 'organization', placeholder: 'e.g., Nexus Robotics, Inc.' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f9fafb' }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MaudieLogo height={40} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Create your account</h2>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;ll be the <span className="font-medium text-gray-700">Owner</span> of your organization with full access.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {fields.map(({ key, type, autoComplete, placeholder, hint }) => (
              <div key={key}>
                <label htmlFor={key} className="block text-sm font-medium text-gray-700 mb-1.5">
                  {FIELD_LABELS[key]}
                </label>
                <input
                  id={key}
                  type={type}
                  autoComplete={autoComplete}
                  value={form[key]}
                  onChange={e => setField(key, e.target.value)}
                  className={inputClass(!!fieldErrors[key])}
                  placeholder={placeholder}
                  aria-invalid={!!fieldErrors[key]}
                  aria-describedby={fieldErrors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined}
                />
                {fieldErrors[key] ? (
                  <p id={`${key}-error`} className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {fieldErrors[key]}
                    {key === 'email' && globalError === 'already_in_use' && (
                      <>
                        {' '}
                        <Link href="/login" className="underline font-medium" style={{ color: '#0d9488' }}>
                          Sign in instead?
                        </Link>
                      </>
                    )}
                  </p>
                ) : hint ? (
                  <p id={`${key}-hint`} className="mt-1 text-xs text-gray-400">{hint}</p>
                ) : null}
              </div>
            ))}

            {globalError && globalError !== 'already_in_use' && (
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#0d9488' }}>
              Sign in
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
