import { DocsNav } from '@/components/DocsNav';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { listDocs } from '@/lib/docs';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = listDocs().map(({ slug, title }) => ({ slug, title }));
  return (
    <>
      <SiteHeader />
      <div className="wrap docs-layout">
        <DocsNav docs={docs} />
        <main className="prose">{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
