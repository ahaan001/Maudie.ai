'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MaudieLogo } from '@/components/layout/MaudieLogo';
import { AlertCircle, Info } from 'lucide-react';

type FieldKey = 'name' | 'email' | 'password' | 'orgName';

const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Full name',
  email: 'Email',
  password: 'Password',
  orgName: 'Organization name',
};

function inputClass(hasError: boolean): string {
  const base =
    'w-full px-3 py-2 rounded-lg text-sm outline-none transition-all ' +
    'bg-white text-gray-900 placeholder-gray-400 ';
  return hasError
    ? base + 'border border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : base + 'border border-gray-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-100';
}

type EmailConflictState = { email: string } | null;

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
  const [emailConflict, setEmailConflict] = useState<EmailConflictState>(null);
  const [loading, setLoading] = useState(false);

  function setField(key: FieldKey, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(e => ({ ...e, [key]: undefined }));
    if (key === 'email') setEmailConflict(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError('');
    setFieldErrors({});
    setEmailConflict(null);

    // Client-side validation
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
        body: JSON.stringify({ ...form, email: form.email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Email already exists — surface recovery options
          setEmailConflict({ email: form.email.trim().toLowerCase() });
          setFieldErrors({ email: 'An account with this email already exists.' });
        } else if (data.fieldErrors) {
          setFieldErrors(data.fieldErrors);
        } else {
          setGlobalError(data.error ?? 'Registration failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Registration succeeded — auto sign-in
      const result = await signIn('credentials', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        redirect: false,
      });

      if (!result?.error && result?.ok) {
        router.push('/dashboard');
      } else {
        // Account created but sign-in failed — let them sign in manually with the success banner
        router.push('/login?registered=true');
      }
    } catch {
      setGlobalError('Something went wrong. Please check your connection and try again.');
      setLoading(false);
    }
  }

  const fields: {
    key: FieldKey;
    type: string;
    autoComplete: string;
    placeholder: string;
    hint?: string;
  }[] = [
    { key: 'name', type: 'text', autoComplete: 'name', placeholder: 'Jane Smith' },
    { key: 'email', type: 'email', autoComplete: 'email', placeholder: 'jane@company.com' },
    {
      key: 'password',
      type: 'password',
      autoComplete: 'new-password',
      placeholder: 'Min. 8 characters',
      hint: 'At least 8 characters.',
    },
    {
      key: 'orgName',
      type: 'text',
      autoComplete: 'organization',
      placeholder: 'e.g., Nexus Robotics, Inc.',
    },
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
            You&apos;ll be the <span className="font-medium text-gray-700">Owner</span> of your
            organization with full access.
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
                />
                {fieldErrors[key] ? (
                  <p className="mt-1 text-xs text-red-600 flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{fieldErrors[key]}</span>
                  </p>
                ) : hint ? (
                  <p className="mt-1 text-xs text-gray-400">{hint}</p>
                ) : null}
              </div>
            ))}

            {/* Email conflict recovery */}
            {emailConflict && (
              <div
                className="rounded-lg p-3 text-sm space-y-2"
                style={{ background: '#fffbeb', border: '1px solid #fcd34d' }}
              >
                <div className="flex items-start gap-2 text-amber-800">
                  <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>
                    <strong>{emailConflict.email}</strong> is already registered.
                  </p>
                </div>
                <div className="flex gap-2 pl-6">
                  <Link
                    href={`/login?email=${encodeURIComponent(emailConflict.email)}`}
                    className="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold text-center"
                    style={{ background: '#0d9488', color: '#fff' }}
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/forgot-password?email=${encodeURIComponent(emailConflict.email)}`}
                    className="flex-1 py-1.5 px-3 rounded-md text-xs font-semibold text-center"
                    style={{ border: '1px solid #d97706', color: '#92400e' }}
                  >
                    Reset password
                  </Link>
                </div>
              </div>
            )}

            {globalError && (
              <div
                className="rounded-lg px-3 py-2.5 text-sm flex items-start gap-2"
                style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}
              >
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
