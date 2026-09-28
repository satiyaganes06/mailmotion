(async () => {
  const D = window.BRAG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const BASE = 1.2;
  const DUR = 24.2;
  const updaters = [];
  const sprites = [];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  // ---------- GIF sprites: frame = pure function of time ----------
  function applyFile(s, st) {
    const m = D.spr[st.file];
    const rows = Math.ceil(m.n / m.cols);
    s.el.style.backgroundImage = `url(/${m.src})`;
    s.el.style.backgroundSize = `${m.cols * s.w}px ${rows * s.h}px`;
    s.cur = st;
    s.total = m.delays.reduce((a, b) => a + b, 0) / 1000;
  }
  function spriteAt(s, t) {
    let st = s.states[0];
    for (const x of s.states) if (t >= x.t) st = x;
    if (st !== s.cur) applyFile(s, st);
    const m = D.spr[st.file];
    let lt = Math.max(0, t - st.t0) % s.total;
    let acc = 0, i = 0;
    for (; i < m.n; i++) { acc += m.delays[i] / 1000; if (lt < acc - 1e-9) break; }
    i = Math.min(i, m.n - 1);
    s.el.style.backgroundPosition = `${-(i % m.cols) * s.w}px ${-Math.floor(i / m.cols) * s.h}px`;
  }
  // states(file) -> [{t, file, t0}]
  function spritify(root, statesFor) {
    for (const img of $$('img', root)) {
      const file = (img.getAttribute('src') || '').split('/').pop();
      if (!file.endsWith('.gif') || !D.spr[file]) continue;
      const w = +img.getAttribute('width'), h = +img.getAttribute('height');
      const el = document.createElement('span');
      el.setAttribute('style', img.getAttribute('style') || '');
      el.classList.add('spr');
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      const s = { el, w, h, states: statesFor(file) };
      applyFile(s, s.states[0]);
      sprites.push(s);
      img.replaceWith(el);
    }
  }
  const kindOf = (presetId, file) => (D.custom[presetId].gifs.find((g) => g.fileName === file) || {}).kind;
  const customStates = (presetId, at) => (file) => {
    const k = kindOf(presetId, file);
    return [{ t: -1e9, file, t0: k === 'mark' ? at - 1.14 : at }];
  };

  // ---------- geometry helpers (app coords inside a 1600x900 cam) ----------
  function rectIn(el, cam) {
    const c = cam.getBoundingClientRect(), r = el.getBoundingClientRect(), k = c.width / 1600;
    return { x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k };
  }
  const union = (a, b) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  function camFit(r, maxZoom = 2, pad = 30, camH = 900) {
    const s = clamp(Math.min(1920 / (r.w + pad * 2), 1080 / (r.h + pad * 2)), BASE, BASE * maxZoom);
    const c = center(r);
    return {
      x: clamp(960 - s * c.x, 1920 - s * 1600, 0),
      y: clamp(540 - s * c.y, 1080 - s * camH, 0),
      scale: s,
    };
  }

  // ---------- fonts + images ----------
  await Promise.all([
    document.fonts.load('600 118px "Fraunces Brag"'),
    document.fonts.load('italic 600 118px "Fraunces Brag"'),
    document.fonts.load('400 16px "Inter Variable"'),
    document.fonts.load('600 16px "Inter Variable"'),
    document.fonts.load('600 30px "Fraunces Variable"'),
    document.fonts.load('400 15px "JetBrains Mono"'),
  ]);

  // ---------- hook + proof signatures ----------
  $('#hook-sig').innerHTML = D.custom.aurora.html;
  spritify($('#hook-sig'), customStates('aurora', 0.62));
  $('#pf-sig').innerHTML = D.custom.wave.html;
  spritify($('#pf-sig'), customStates('wave', 18.1));

  // ---------- Simple Style builder ----------
  const camS = $('#cam-simple');
  const NAME = 'Satiya Ganes', PLACE = 'Your Name';
  const T = { click: 7.1, type: 7.25, per: 0.068, rerender: 8.12 };
  const signetByName = Object.fromEntries(Object.entries(D.signet).map(([k, v]) => [v.name, k]));
  const cards = $$('#sc-simple .sg-spec');
  const nameNodes = [];
  let inkCard = null;
  for (const card of cards) {
    const id = signetByName[$('h2', card).textContent.trim()];
    const sig = $('.sg-sig', card);
    sig.innerHTML = D.signet[id].html;
    for (const el of $$('*', sig))
      if (!el.children.length && el.textContent.trim() === NAME) nameNodes.push(el);
    if (id === 'ink') inkCard = card;
    spritify(sig, (file) => [
      { t: -1e9, file: file.replace('.gif', '-yn.gif'), t0: 0 },
      { t: T.rerender, file, t0: id === 'ink' ? 9.4 : T.rerender },
    ]);
  }
  const vals = { 'sg-title': 'Founder', 'sg-company': 'MailMotion', 'sg-phone': '', 'sg-email': 'satiyaganes.sg@example.com',
    'sg-website': 'github.com/satiyaganes06/mailmotion', 'sg-tagline': 'Animated signatures that actually render', 'sg-status': 'Shipping MailMotion v1' };
  for (const [id, v] of Object.entries(vals)) { $('#' + id).value = v; $('#' + id).setAttribute('value', v); }
  const nameIn = $('#sg-name');
  const field = nameIn.parentElement;
  field.style.position = 'relative';
  const caret = document.createElement('i'); caret.className = 'fake-caret';
  const sel = document.createElement('i'); sel.className = 'fake-sel';
  field.append(sel, caret);
  const cs = getComputedStyle(nameIn);
  const mctx = document.createElement('canvas').getContext('2d');
  mctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const padL = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
  const fh = parseFloat(cs.fontSize) * 1.25;
  const inTop = nameIn.offsetTop + (nameIn.offsetHeight - fh) / 2;
  Object.assign(caret.style, { top: inTop + 'px', height: fh + 'px' });
  Object.assign(sel.style, { top: inTop + 'px', height: fh + 'px', left: nameIn.offsetLeft + padL + 'px',
    width: mctx.measureText(PLACE).width + 'px' });
  updaters.push((t) => {
    let v = PLACE;
    if (t >= T.type) v = NAME.slice(0, clamp(Math.floor((t - T.type) / T.per) + 1, 0, NAME.length));
    nameIn.value = v;
    for (const n of nameNodes) n.textContent = v || ' ';
    const focused = t >= T.click && t < 8.35;
    nameIn.classList.toggle('focus-sim', focused);
    sel.style.opacity = t >= T.click + 0.03 && t < T.type ? 1 : 0;
    const typingEnd = T.type + NAME.length * T.per;
    const blinkOn = t < typingEnd + 0.05 || Math.floor((t - typingEnd) / 0.5) % 2 === 1;
    caret.style.opacity = focused && t >= T.type && blinkOn ? 1 : 0;
    caret.style.left = nameIn.offsetLeft + padL + mctx.measureText(v).width + 1 + 'px';
  });
  const toast = $('#sc-simple .sg-toast');
  toast.textContent = 'Signature copied. Paste it into the Gmail or Outlook signature box.';
  toast.classList.add('sg-show');

  // ---------- Custom Style builder ----------
  const camC = $('#cam-custom');
  const SEQ = [{ t: -1e9, id: 'aurora' }, { t: 13.7, id: 'neon' }, { t: 14.76, id: 'equalizer' }, { t: 15.81, id: 'wave' }];
  const tiles = {};
  for (const b of $$('#sc-custom .presets .preset')) {
    const id = Object.keys(D.custom).find((k) => b.textContent.trim().startsWith(D.custom[k].name));
    tiles[id] = b;
  }
  const pvSig = $('#pv-sig');
  const vars = {};
  for (const s of SEQ) {
    const d = document.createElement('div');
    d.className = 'pv-var';
    d.innerHTML = D.custom[s.id].html;
    pvSig.append(d);
    spritify(d, customStates(s.id, Math.max(0, s.t)));
    vars[s.id] = d;
  }
  const meters = $('#sc-custom .meters');
  meters.innerHTML = ['chars', 'avatar', 'mark', 'banner'].map((k) =>
    `<div class="meter" data-k="${k}"><div class="meter-head"><span class="lbl"></span><span class="mono val"></span></div>` +
    `<div class="meter-bar good"><i></i></div></div>`).join('');
  const kb = (n) => `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  const LBL = { avatar: 'Avatar', mark: 'Signature mark', banner: 'Banner' };
  const gifOf = (id, k) => D.custom[id].gifs.find((g) => g.kind === k);
  updaters.push((t) => {
    let i = 0;
    SEQ.forEach((s, j) => { if (t >= s.t) i = j; });
    const cur = SEQ[i], prev = SEQ[Math.max(0, i - 1)];
    const p = i === 0 ? 1 : easeOut(clamp((t - cur.t) / 0.55, 0, 1));
    for (const [id, d] of Object.entries(vars)) d.classList.toggle('show', id === cur.id);
    for (const [id, b] of Object.entries(tiles)) b.classList.toggle('on', id === cur.id);
    const c = D.custom[cur.id].controls;
    $('#rx-layout').value = c.layout; $('#rx-av').value = c.avatar; $('#rx-mark').value = c.mark;
    const lerp = (a, b) => a + (b - a) * p;
    for (const row of $$('.meter', meters)) {
      const k = row.dataset.k;
      let val, max, label, right;
      if (k === 'chars') {
        val = lerp(D.custom[prev.id].chars, D.custom[cur.id].chars); max = 10000;
        label = 'HTML characters (Gmail limit)';
        right = `${Math.round(val).toLocaleString('en-US')} / 10,000`;
      } else {
        const g = gifOf(cur.id, k);
        row.style.display = g ? '' : 'none';
        if (!g) continue;
        const pg = gifOf(prev.id, k);
        val = pg ? lerp(pg.bytes, g.bytes) : g.bytes * p; max = 300 * 1024;
        label = `${LBL[k]} GIF (${g.frames} frames)`;
        right = `${kb(val)} / 300 KB`;
      }
      $('.lbl', row).textContent = label;
      $('.val', row).textContent = right;
      $('i', row).style.width = `${Math.min(100, (val / max) * 100)}%`;
    }
  });

  const pvDoc = $('#pv-doc');
  let pvH = 0;
  for (const d of Object.values(vars)) {
    d.classList.add('show');
    pvH = Math.max(pvH, pvDoc.scrollHeight);
    d.classList.remove('show');
  }
  pvDoc.style.height = pvH + 'px';
  camC.style.height = '1500px';

  // run updaters once so layout (meters, names) is final before measuring
  for (const f of updaters) f(0);

  // ---------- measurements (cams at base) ----------
  const camStart = $('#cam-start');
  for (const c of [camStart, camS, camC]) gsap.set(c, { x: 0, y: 0, scale: BASE });
  const simpleCard = $$('#sc-start .start-card')[0];
  const rSimpleCard = rectIn(simpleCard, camStart);
  const rName = rectIn(nameIn, camS);
  const rFirst = rectIn(cards[0], camS);
  const rDetails = rectIn($('#sc-simple .sg-editor form'), camS);
  const list = $('#sc-simple .sg-list');
  const rInk = rectIn(inkCard, camS);
  const SCROLL = rInk.y + rInk.h - 800;
  const rInkAfter = { ...rInk, y: rInk.y - SCROLL };
  const copyBtn = $('.sg-actions .btn.primary', inkCard);
  const rCopy = rectIn(copyBtn, camS); rCopy.y -= SCROLL;
  const rToast = rectIn(toast, camS);
  const rDesign = rectIn($('#sc-custom #design'), camC);
  const rPreview = rectIn(pvDoc, camC);
  const rPresets = rectIn($('#sc-custom .presets'), camC);
  const rStartWrap = rectIn($('#sc-start .start-wrap'), camStart);
  // meters with the final (wave) state, to frame the push-in
  for (const f of updaters) f(20);
  const rMeters = rectIn(meters, camC);
  for (const f of updaters) f(0);

  // ---------- timeline ----------
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  const cursorPos = (p) => ({ x: p.x - 3, y: p.y - 2 });
  function move(cur, p, at, dur) {
    tl.to(cur, { x: p.x - 3, duration: dur, ease: 'power2.inOut' }, at);
    tl.to(cur, { y: p.y - 2, duration: dur, ease: 'power1.inOut' }, at);
  }
  function click(cur, rp, p, at, target) {
    tl.to(cur, { scale: 0.8, duration: 0.07, ease: 'power2.out' }, at);
    tl.to(cur, { scale: 1, duration: 0.2, ease: 'power2.out' }, at + 0.07);
    tl.fromTo(rp, { x: p.x, y: p.y, scale: 0.3, opacity: 0.95 },
      { scale: 1.6, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, at);
    if (target) {
      tl.to(target, { scale: 0.965, duration: 0.07, ease: 'power2.out' }, at);
      tl.to(target, { scale: 1, duration: 0.3, ease: 'back.out(3)' }, at + 0.07);
    }
  }
  const show = (sel, at) => tl.set(sel, { opacity: 1 }, at);
  const hide = (sel, at) => tl.set(sel, { opacity: 0 }, at);

  tl.fromTo('#glow', { xPercent: 0, yPercent: 0 }, { xPercent: -7, yPercent: 4, duration: DUR, ease: 'none' }, 0);

  // S1 hook 0 - 3.7
  show('#sc-hook', 0);
  const hookW = $$('#hook-h .w');
  tl.fromTo('#hook-brand', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 0.1);
  tl.fromTo(hookW.slice(0, 4), { yPercent: 118 }, { yPercent: 0, duration: 0.8, ease: 'power4.out', stagger: 0.09 }, 0.12);
  tl.fromTo(hookW.slice(4), { yPercent: 118 }, { yPercent: 0, duration: 0.75, ease: 'expo.out', stagger: 0.1 }, 1.2);
  const em = $('#hook-h em').getBoundingClientRect();
  Object.assign($('#hook-swash').style, { left: em.left + 6 + 'px', top: em.bottom - 10 + 'px', width: em.width - 12 + 'px' });
  tl.fromTo('#hook-swash', { scaleX: 0 }, { scaleX: 1, duration: 0.55, ease: 'power3.inOut' }, 1.62);
  tl.fromTo('#hook-card', { x: 140, opacity: 0, rotationY: -26, rotationX: 8, scale: 1.2 },
    { x: 0, opacity: 1, rotationY: -10, rotationX: 3, scale: 1.32, duration: 1.3, ease: 'power3.out' }, 0.55);
  tl.to('#hook-card', { rotationY: -6, rotationX: 1.5, y: -10, duration: 1.6, ease: 'sine.inOut' }, 1.85);
  tl.to(hookW, { yPercent: -118, duration: 0.42, ease: 'power3.in', stagger: 0.03 }, 3.3);
  tl.to(['#hook-brand', '#hook-swash'], { opacity: 0, duration: 0.3, ease: 'power2.in' }, 3.3);
  tl.to('#hook-card', { x: 160, opacity: 0, duration: 0.42, ease: 'power2.in' }, 3.32);
  hide('#sc-hook', 3.8);

  // S2 pick your style 3.7 - 5.8
  show('#sc-start', 3.66);
  const startEls = ['.eyebrow', 'h1', '.lede', '.start-card', '.start-wrap > .field-hint'].flatMap((s) => $$(`#sc-start ${s}`));
  tl.fromTo(startEls, { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, stagger: 0.07 }, 3.7);
  tl.fromTo(camStart, { ...camFit(rStartWrap, 1.7, 70) }, { ...camFit(rStartWrap, 1.8, 40), duration: 1.6, ease: 'sine.inOut' }, 3.66);
  const curS = $('#cur-start'), rpS = $('#rp-start');
  const pSimple = center(rSimpleCard);
  tl.set(curS, { ...cursorPos({ x: 1260, y: 830 }) }, 0);
  tl.to(curS, { opacity: 1, duration: 0.2 }, 4.2);
  move(curS, pSimple, 4.25, 0.62);
  tl.to(simpleCard, { y: -4, borderColor: '#b34700', boxShadow: '0 22px 44px -24px rgba(28,27,25,.38)', duration: 0.25, ease: 'power2.out' }, 4.8);
  click(curS, rpS, pSimple, 5.12, simpleCard);
  tl.to(camStart, { ...camFit(rSimpleCard, 2.4, 0), duration: 0.5, ease: 'power2.in' }, 5.3);
  tl.to('#sc-start', { opacity: 0, duration: 0.24, ease: 'power1.in' }, 5.54);

  // S3 simple builder 5.78 - 12.62
  tl.fromTo('#sc-simple', { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out' }, 5.78);
  tl.fromTo(camS, { x: -50, y: -28, scale: BASE * 1.06 }, { x: 0, y: 0, scale: BASE, duration: 0.8 }, 5.78);
  const rNameZone = { x: rName.x - 12, y: rName.y - 44, w: rName.w + 24, h: rName.h + 56 };
  tl.to(camS, { ...camFit(union(rNameZone, rFirst), 1.8, 24), duration: 0.85, ease: 'power3.inOut' }, 6.34);
  const curSi = $('#cur-simple'), rpSi = $('#rp-simple');
  const pName = { x: rName.x + rName.w * 0.62, y: center(rName).y };
  tl.set(curSi, { ...cursorPos({ x: 720, y: 560 }) }, 0);
  tl.to(curSi, { opacity: 1, duration: 0.2 }, 6.45);
  move(curSi, pName, 6.5, 0.55);
  click(curSi, rpSi, pName, T.click, null);
  tl.to(camS, { x: 0, y: 0, scale: BASE, duration: 0.65, ease: 'power3.inOut' }, 8.3);
  move(curSi, { x: 1180, y: 520 }, 8.3, 0.6);
  tl.to(list, { y: -SCROLL, duration: 1.9, ease: 'power2.inOut' }, 8.96);
  const rInkZone = union(rInkAfter, rToast);
  tl.to(camS, { ...camFit(rInkZone, 1.8, 26), duration: 0.7, ease: 'power3.inOut' }, 10.85);
  move(curSi, center(rCopy), 11.0, 0.45);
  click(curSi, rpSi, center(rCopy), 11.55, copyBtn);
  tl.fromTo(toast, { xPercent: -50, opacity: 0, y: 16 }, { xPercent: -50, opacity: 1, y: 0, duration: 0.35 }, 11.64);
  tl.to('#sc-simple', { opacity: 0, x: -170, duration: 0.32, ease: 'power2.in' }, 12.3);

  // S4 custom builder 12.62 - 17.9
  tl.fromTo('#sc-custom', { opacity: 0, x: 170 }, { opacity: 1, x: 0, duration: 0.55 }, 12.62);
  tl.to(camC, { ...camFit(union(rPresets, rPreview), 1.6, 24, 1500), duration: 0.65, ease: 'power3.inOut' }, 13.0);
  const curC = $('#cur-custom'), rpC = $('#rp-custom');
  tl.set(curC, { ...cursorPos({ x: 760, y: 520 }) }, 0);
  tl.to(curC, { opacity: 1, duration: 0.2 }, 13.0);
  for (const s of SEQ.slice(1)) {
    const p = center(rectIn(tiles[s.id], camC));
    move(curC, p, s.t - 0.62, 0.52);
    click(curC, rpC, p, s.t, tiles[s.id]);
    tl.to(pvSig, { opacity: 0, y: -6, duration: 0.1, ease: 'power1.in' }, s.t - 0.1);
    tl.fromTo(pvSig, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.42, immediateRender: false }, s.t);
  }
  move(curC, { x: center(rMeters).x + 220, y: rMeters.y - 30 }, 16.25, 0.6);
  tl.to(curC, { opacity: 0, duration: 0.25 }, 16.7);
  tl.to(camC, { ...camFit(rMeters, 2.0, 60, 1500), duration: 0.75, ease: 'power3.inOut' }, 16.3);
  tl.to('#sc-custom', { opacity: 0, scale: 0.97, duration: 0.34, ease: 'power2.in' }, 17.55);

  // S5 proof 17.9 - 20.5
  show('#sc-proof', 17.88);
  const pfW = $$('#pf-h .w');
  tl.fromTo(pfW, { yPercent: 118 }, { yPercent: 0, duration: 0.75, ease: 'power4.out', stagger: 0.055 }, 17.92);
  tl.fromTo('#pf-card', { x: 150, opacity: 0, rotationY: 26, rotationX: 8, scale: 1.08 },
    { x: 0, opacity: 1, rotationY: 9, rotationX: 3, scale: 1.3, duration: 1.2 }, 18.0);
  tl.to('#pf-card', { rotationY: 5, y: -8, duration: 1.4, ease: 'sine.inOut' }, 19.1);
  [18.44, 18.96, 19.49].forEach((at, i) =>
    tl.fromTo(`#chip-${i}`, { opacity: 0, scale: 0.6, y: 18 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(2.2)' }, at));
  tl.to(pfW, { yPercent: -118, duration: 0.4, ease: 'power3.in', stagger: 0.025 }, 20.12);
  tl.to(['.chips', '#pf-card'], { opacity: 0, y: -14, duration: 0.36, ease: 'power2.in', stagger: 0.05 }, 20.14);
  hide('#sc-proof', 20.6);

  // S6 outro 20.5 - 24.2
  show('#sc-outro', 20.45);
  tl.fromTo('#o-mark', { clipPath: 'inset(0% 100% 0% 0%)', scale: 0.9, y: 24 },
    { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, y: 0, duration: 0.95, ease: 'power3.inOut' }, 20.54);
  tl.fromTo('#o-word', { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'power4.out' }, 21.0);
  tl.fromTo('#o-eyebrow', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6 }, 21.3);
  tl.fromTo('#o-cta', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 }, 21.62);

  // captions
  const cap = (id, a, b) => {
    tl.fromTo(id, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.5 }, a);
    tl.to(id, { opacity: 0, y: 12, duration: 0.3, ease: 'power2.in' }, b);
  };
  cap('#cap-1', 7.35, 10.7);
  cap('#cap-2', 13.0, 16.2);
  cap('#cap-3', 16.45, 17.6);

  window.DURATION = DUR;
  window.renderAt = (t) => {
    tl.seek(t, false);
    for (const f of updaters) f(t);
    for (const s of sprites) spriteAt(s, t);
  };
  await Promise.all([...new Set(Object.values(D.spr).map((m) => '/' + m.src)), '/assets/logo-mark.png', '/assets/logo-word.png']
    .map((src) => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); }));
  await document.fonts.ready;
  window.renderAt(0);
  window.__ready = true;
})().catch((e) => { window.__error = String(e && e.stack || e); console.error(e); });
