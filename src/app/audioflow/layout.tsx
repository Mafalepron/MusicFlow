import Link from 'next/link';

export default function AudioFlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ fontWeight: 700 }}>MusicFlow Unified</Link>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/audioflow" className="active">AudioFlow</Link>
            <Link href="/kanban">Kanban</Link>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}
