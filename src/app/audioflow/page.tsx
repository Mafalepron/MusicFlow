'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function AudioFlowPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // small delay to show loader
    const t = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="page">
      <div className="container">
        <div className="card panel">
          <nav style={{ marginBottom: '1rem' }}>
            <Link href="/">Home</Link>
            <Link href="/audioflow" className="active">AudioFlow</Link>
            <Link href="/kanban">Kanban</Link>
          </nav>
          <h1>AudioFlow (embedded)</h1>
          <p style={{ color: '#cbd5e1', lineHeight: 1.7 }}>
            This view embeds the original AudioFlow app running on port 3000.
          </p>
          <div style={{ marginTop: '1rem' }}>
            {!ready ? (
              <div style={{ padding: '1rem' }}>Loading...</div>
            ) : (
              <div style={{ height: '72vh', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <iframe
                  src="http://localhost:3000"
                  title="AudioFlow"
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                />
              </div>
            )}
            <p style={{ color: '#94a3b8', marginTop: '0.6rem' }}>If the app doesn't load, start the original AudioFlow project: <code>cd "../audioflow v5" && npm run dev</code></p>
          </div>
        </div>
      </div>
    </main>
  );
}
