'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ fontSize: '4rem', margin: 0 }}>⚠️</p>
          <h1 style={{ fontSize: '1.5rem', color: '#1e293b', marginTop: '1rem' }}>Something went wrong</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', maxWidth: '400px', margin: '0.5rem auto' }}>
            {error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
