/**
 * Optional cookieless analytics (Plausible or Umami). Nothing is loaded unless both env vars are
 * set at build time. It measures the site only, never anything inside a signature.
 */
export function Analytics() {
  const src = process.env.NEXT_PUBLIC_ANALYTICS_SRC;
  const domain = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN;
  if (!src || !domain) return null;
  if (!/^https:\/\//.test(src)) return null;
  // Plausible uses data-domain; Umami uses data-website-id. Both are set so either script works.
  return <script defer src={src} data-domain={domain} data-website-id={domain} />;
}
