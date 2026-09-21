---
title: Privacy
order: 8
---

# Privacy

- **No accounts, no tracking pixels, no read receipts.** Signatures never contain anything that reports who opened an email.
- **Your photo stays in your browser** until you publish the finished images yourself. Uploaded photos are re-encoded through a canvas, which drops EXIF data such as GPS location.
- **Drafts** are saved in your browser (IndexedDB) so you can come back. Nothing is sent to a MailMotion server, because the hosted builder has no backend apart from one small sign-in function.
- **GitHub token:** if you publish with GitHub, the token is kept in memory only, never stored, and expires after 8 hours. The sign-in function forwards the exchange and returns the token to your browser; it stores and logs nothing.
- **"Send to my phone"** puts the signature in the _URL fragment_ (`#d=...`), which browsers never send to any server. The link expires after 24 hours and pages are `noindex`.
- **Site analytics** are optional and off unless the deployer sets them. If enabled they use a cookieless service (Plausible or Umami) and measure the website only, never anything inside a signature.
- **Public images:** the images you publish are, by necessity, public URLs (that is how email clients load them). On GitHub Pages this means a public repository.

Malaysia's PDPA (including the 2024 amendments) and the EU GDPR both apply to how you use signatures containing personal data. If you deploy this for a team, add your own notice and DPA where required.
