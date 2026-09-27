import type { Metadata } from 'next';
import { SignetStudio } from '@/signet/SignetStudio';

export const metadata: Metadata = {
  title: 'Simple Style',
  description:
    'Ten ready-made animated email signature designs. Fill in your details, upload the images in one click, copy the signature.',
};

export default function SimpleStylePage() {
  return <SignetStudio />;
}
