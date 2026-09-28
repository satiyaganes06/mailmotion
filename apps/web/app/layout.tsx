import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
import './globals.css';
import './studio.css';
import { Analytics } from '@/components/Analytics';

const SITE_URL = 'https://mailmotion-ten.vercel.app';
const DESCRIPTION =
  'Open-source, self-hostable animated email signatures for Gmail, Outlook and Apple Mail. Private by default: no tracking pixels, no accounts.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'MailMotion: animated email signatures that render',
    template: '%s · MailMotion',
  },
  description: DESCRIPTION,
  applicationName: 'MailMotion',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icons/icon-180.png' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'MailMotion',
    title: 'MailMotion: animated email signatures that render',
    description: DESCRIPTION,
    images: [{ url: '/og.jpg', width: 1920, height: 1080, alt: 'MailMotion' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MailMotion: animated email signatures that render',
    description: DESCRIPTION,
    images: ['/og.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#15130f' },
  ],
};

// Runs before paint so a saved theme never flashes. (Static text: no user input.)
const themeScript = `try{var t=localStorage.getItem('mm-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
