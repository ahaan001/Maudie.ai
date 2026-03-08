import Link from 'next/link';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)' }}>
      {/* Settings sidebar nav */}
      <nav style={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        padding: '24px 0',
      }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(245,244,240,0.35)', padding: '0 16px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Settings
        </p>
        <Link
          href="/settings/team"
          style={{
            display: 'block', padding: '8px 16px',
            fontSize: 13, color: 'var(--off-white)',
            textDecoration: 'none',
          }}
        >
          Team Members
        </Link>
      </nav>
      <main style={{ flex: 1, padding: 32, maxWidth: 900 }}>
        {children}
      </main>
    </div>
  );
}
