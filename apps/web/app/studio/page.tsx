import type { Metadata } from 'next';
import { Studio } from '@/components/Studio';

export const metadata: Metadata = {
  title: 'Builder',
  description:
    'Design, preview and export an animated email signature. Everything runs in your browser.',
};

export default function StudioPage() {
  return <Studio />;
}
