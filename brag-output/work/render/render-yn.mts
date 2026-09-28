import { writeFileSync } from 'node:fs';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { DESIGNS, DEFAULT_ACCENT, renderGif } from '@mailmotion/signet';
GlobalFonts.registerFromPath('/Users/sivajipro/Developer/Apps/MailMotion/apps/web/public/fonts/Caveat.ttf', 'Caveat');
const d = { name: 'Your Name', title: 'Founder', company: 'MailMotion', phone: '', email: 'satiyaganes.sg@example.com', website: 'github.com/satiyaganes06/mailmotion', tagline: 'Animated signatures that actually render', status: 'Shipping MailMotion v1' };
for (const x of DESIGNS) {
  const gif = renderGif(x.id, d, DEFAULT_ACCENT, (w, h) => createCanvas(w, h) as never);
  writeFileSync(`../assets/img/signet-${x.id}-yn.gif`, gif.bytes);
}
