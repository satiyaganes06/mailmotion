'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function DocsNav({ docs }: { docs: { slug: string; title: string }[] }) {
  const path = usePathname();
  return (
    <nav className="docs-nav" aria-label="Documentation">
      {docs.map((d) => (
        <Link
          key={d.slug}
          href={`/docs/${d.slug}/`}
          aria-current={path === `/docs/${d.slug}/` ? 'page' : undefined}
        >
          {d.title}
        </Link>
      ))}
      <Link href="/compat/" aria-current={path === '/compat/' ? 'page' : undefined}>
        Compatibility
      </Link>
    </nav>
  );
}
