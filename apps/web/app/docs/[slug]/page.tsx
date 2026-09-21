import { notFound } from 'next/navigation';
import { getDoc, listDocs } from '@/lib/docs';

export const dynamicParams = false;

export function generateStaticParams() {
  return listDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: getDoc(slug)?.title ?? 'Docs' };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  // Trusted: our own markdown, rendered at build time.
  return <article dangerouslySetInnerHTML={{ __html: doc.html }} />;
}
