import type { Metadata } from 'next';
import { SimpleStudio } from '@/components/SimpleStudio';

export const metadata: Metadata = {
  title: 'Builder · Simple Style',
  description:
    'Ten ready-made animated email signature designs, one accent colour, a handful of fields. Everything runs in your browser.',
};

export default function SimpleStudioPage() {
  return <SimpleStudio />;
}
