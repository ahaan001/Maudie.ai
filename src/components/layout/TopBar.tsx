'use client';

import { useState } from 'react';
import { Bell, Command, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useCommandPalette } from '../providers';

interface Notification {
  id: string;
  type: 'complete' | 'review' | 'warning';
  message: string;
  time: string;
  read: boolean;
}

// Mock notifications — replace with real API data when available
const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'complete', message: 'Documentation draft generated for risk analysis section', time: '2m ago', read: false },
  { id: '2', type: 'review', message: 'Review task pending: Software SOUP List v2', time: '14m ago', read: false },
  { id: '3', type: 'complete', message: 'MAUDE intelligence analysis complete', time: '1h ago', read: true },
  { id: '4', type: 'warning', message: 'Classification mismatch detected in IFU section', time: '3h ago', read: true },
  { id: '5', type: 'complete', message: 'Hazard identification agent run finished', time: '5h ago', read: true },
];

export function TopBar() {
  const { setOpen } = useCommandPalette();
  const [bellOpen, setBellOpen] = useState(false);
  const unread = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <div
      className="h-12 flex items-center justify-end px-6 gap-3 sticky top-0 z-40"
      style={{
        background: 'linear-gradient(180deg, var(--navy) 0%, transparent 100%)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* ⌘K trigger */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs opacity-40 hover:opacity-70 transition-opacity"
        style={{ border: '1px solid var(--border)', color: 'var(--off-white)' }}
      >
        <Command className="h-3 w-3" />
        <span className="font-mono">K</span>
      </button>

      {/* Notification bell */}
      <div className="relative">
        <button
          onClick={() => setBellOpen(v => !v)}
          className="relative p-2 rounded-lg transition-colors hover:opacity-80"
          style={{ color: 'var(--off-white)' }}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: 'var(--teal)', boxShadow: '0 0 6px var(--teal)' }}
            />
          )}
        </button>

        {bellOpen && (
          <>
            {/* Click outside to close */}
            <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />

            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--navy-700)',
                border: '1px solid var(--border-hover)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between text-sm font-medium border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <span>Notifications</span>
                {unread > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-mono"
                    style={{ background: 'var(--teal-dim)', color: 'var(--teal)' }}
                  >
                    {unread} new
                  </span>
                )}
              </div>

              <div className="divide-y divide-white/[0.08]">
                {MOCK_NOTIFICATIONS.map(n => (
                  <NotificationRow key={n.id} notification={n} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification: n }: { notification: Notification }) {
  const Icon = n.type === 'complete' ? CheckCircle : n.type === 'review' ? Clock : AlertTriangle;
  const iconColor =
    n.type === 'complete' ? 'var(--green-ok)' :
    n.type === 'review' ? 'var(--amber)' :
    'var(--red-flag)';

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/5"
      style={{ opacity: n.read ? 0.5 : 1 }}
    >
      <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: iconColor }} />
      <div className="min-w-0 flex-1">
        <p className="leading-snug text-xs" style={{ color: 'var(--off-white)' }}>
          {n.message}
        </p>
        <p className="text-[11px] mt-1 opacity-40 font-mono">{n.time}</p>
      </div>
      {!n.read && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: 'var(--teal)' }}
        />
      )}
    </div>
  );
}
