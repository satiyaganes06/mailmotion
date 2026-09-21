import { DocsNav } from '@/components/DocsNav';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getCompat, listDocs } from '@/lib/docs';

export const metadata = {
  title: 'Compatibility',
  description:
    'How MailMotion signatures render and install in Gmail, Outlook and Apple Mail, and what is verified.',
};

export default function CompatPage() {
  const docs = listDocs().map(({ slug, title }) => ({ slug, title }));
  const c = getCompat();
  return (
    <>
      <SiteHeader />
      <div className="wrap docs-layout">
        <DocsNav docs={docs} />
        <main className="prose" dangerouslySetInnerHTML={{ __html: c.html }} />
      </div>
      <SiteFooter />
    </>
  );
}
