import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export const REPO_URL = 'https://github.com/satiyaganes06/mailmotion';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          MailMotion
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/#designs" className="hide-sm">
            Designs
          </Link>
          <Link href="/docs/" className="hide-sm">
            Docs
          </Link>
          <Link href="/compat/" className="hide-sm">
            Compatibility
          </Link>
          <a href={REPO_URL} className="hide-sm">
            GitHub
          </a>
          <ThemeToggle />
          <Link href="/studio/" className="btn primary small">
            Open builder
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <strong>MailMotion</strong> is open source. Apps are AGPL-3.0, packages are MIT.
          <br />
          No tracking pixels. No accounts. Your photos never leave your browser.
        </div>
        <ul>
          <li>
            <Link href="/docs/">Docs</Link>
          </li>
          <li>
            <Link href="/docs/privacy/">Privacy</Link>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/SECURITY.md`}>Security</a>
          </li>
          <li>
            <a href={`${REPO_URL}/blob/main/LICENSING.md`}>Licensing</a>
          </li>
          <li>
            <a href={REPO_URL}>GitHub</a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
