import { redirect } from 'next/navigation';

export const metadata = { title: 'Docs' };

export default function DocsIndex() {
  redirect('/docs/getting-started/');
}
