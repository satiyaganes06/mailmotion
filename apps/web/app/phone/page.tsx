import type { Metadata } from 'next';
import { PhoneView } from '@/components/PhoneView';

export const metadata: Metadata = {
  title: 'Your signature',
  description: 'Copy your MailMotion signature into your phone’s mail app.',
  robots: { index: false, follow: false, nocache: true },
};

export default function PhonePage() {
  return <PhoneView />;
}
