'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { completeSignIn } from '@/lib/github-flow';

export default function Callback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    completeSignIn(window.location.search).then((r) => {
      if (!live) return;
      // Client-side navigation keeps the in-memory token (a full reload would drop it).
      if (r.ok) router.replace('/studio/?publish=1');
      else setError(r.message);
    });
    return () => {
      live = false;
    };
  }, [router]);

  return (
    <main className="wrap" style={{ paddingTop: 80, maxWidth: 560 }}>
      <h1 style={{ fontSize: 30, marginBottom: 12 }}>
        {error ? 'Sign-in did not finish' : 'Connecting to GitHub…'}
      </h1>
      {error ? (
        <>
          <p className="lede">{error}</p>
          <p style={{ marginTop: 16 }}>
            <Link href="/studio/" className="btn primary">
              Back to the builder
            </Link>
          </p>
        </>
      ) : (
        <p className="lede">One moment. Your signature draft is safe in this browser.</p>
      )}
    </main>
  );
}
