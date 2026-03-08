'use client';

import { useState, useEffect } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { MaudieLogo } from '@/components/layout/MaudieLogo';

interface InviteInfo {
  email: string;
  role: string;
  orgId: string;
  isNewUser: boolean;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const { data: sessionData } = useSession();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState('');

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/org/accept-invite?token=${token}`)
      .then(res => res.json())
      .then((data: InviteInfo & { error?: string }) => {
        if (data.error) {
          setLoadError(data.error);
        } else {
          setInvite(data);
        }
      })
      .catch(() => setLoadError('Failed to load invitation'));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const body: Record<string, string> = { token };
      if (invite?.isNewUser) {
        body.name = name;
        body.password = password;
      }

      const res = await fetch('/api/org/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { error?: string; email?: string };

      if (!res.ok) {
        setError(data.error ?? 'Failed to accept invitation');
        setLoading(false);
        return;
      }

      if (invite?.isNewUser) {
        const result = await signIn('credentials', {
          email: invite.email,
          password,
          redirect: false,
        });
        if (result?.error) {
          setError('Account created but sign-in failed. Please go to login.');
          setLoading(false);
          return;
        }
      }

      router.push('/dashboard');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-sm font-medium">{loadError}</p>
          <p className="text-gray-500 text-sm mt-2">This invitation may have expired or already been used.</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <MaudieLogo height={40} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Join your team</h2>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;ve been invited as <strong>{invite.role}</strong> at this organization.
          </p>

          <div className="bg-gray-50 rounded-md px-3 py-2 mb-4">
            <p className="text-xs text-gray-500">Invitation for</p>
            <p className="text-sm font-medium text-gray-900">{invite.email}</p>
          </div>

          {sessionData?.user && !invite.isNewUser ? (
            // Existing logged-in user accepting invite
            <form onSubmit={handleAccept}>
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {loading ? 'Joining…' : 'Join organization'}
              </button>
            </form>
          ) : invite.isNewUser ? (
            // New user — collect name + password
            <form onSubmit={handleAccept} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Your name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Choose a password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Min. 8 characters"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-md transition-colors"
              >
                {loading ? 'Creating account…' : 'Create account & join'}
              </button>
            </form>
          ) : (
            // Existing user not logged in — prompt to log in first
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Please sign in with your existing account to accept this invitation.
              </p>
              <a
                href={`/login?callbackUrl=${encodeURIComponent(`/auth/invite/${token}`)}`}
                className="block w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors text-center"
              >
                Sign in to continue
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
