import json, re, os, html as H

W = os.path.dirname(os.path.abspath(__file__))
cap = lambda n: open(f'{W}/capture/{n}.html').read()

REAL = [
    ('Shatthiya Ganes', 'Satiya Ganes'),
    ('Mobile Security Engineer', 'Founder'),
    ('Google Inc.', 'MailMotion'),
    ('satiyaganes.sg@gmail.com', 'satiyaganes.sg@example.com'),
    ('https://www.satiyaganes.site', 'https://github.com/satiyaganes06/mailmotion'),
    ('www.satiyaganes.site', 'github.com/satiyaganes06/mailmotion'),
    ('+60 1163348685', ''),
    ('tel:+601163348685', 'tel:'),
    ('https://www.linkedin.com/in/satiya-ganes-b0a315209', 'https://github.com/satiyaganes06'),
    ('Full-stack security &amp; mobile engineering', 'Animated signatures that actually render'),
    ('Full-stack security & mobile engineering', 'Animated signatures that actually render'),
    ('Open to opportunities', 'Shipping MailMotion v1'),
]
LEAK = ['Shatthiya', 'Mobile Security', 'Google Inc','1163348685', 'gmail.com', 'satiyaganes.site', 'linkedin.com/in/satiya']


def scrub(s):
    for a, b in REAL:
        s = s.replace(a, b)
    s = re.sub(r'<img[^>]*src="blob:[^"]*"[^>]*>', '', s)
    s = re.sub(r'<div class="sg-sig">.*?</table></div>', '<div class="sg-sig"></div>', s, flags=re.S)
    return s


def between(s, start, end='</body>'):
    i = s.index(start)
    return s[i:s.index(end, i)]


start = re.search(r'<main class="start-gate">.*?</main>', cap('start'), re.S).group(0)
simple = between(cap('simple'), '<div class="sg studio">')
custom = between(cap('custom'), '<div class="studio">')
custom = re.sub(r'<iframe[^>]*>.*?</iframe>',
                '<div class="preview-frame pv-doc" id="pv-doc">'
                '<div class="bar"><span class="acc"></span><b>You</b> <span>to Sam Rivera</span><br>'
                '<span>Re: Quick question about Thursday</span></div>'
                '<div class="msg"><p>Hi Sam,</p><p>Thanks for the update. Thursday works for me. '
                'I’ll send the slides over beforehand.</p><p>Best,</p>'
                '<div class="sig" id="pv-sig"></div></div></div>', custom, flags=re.S)

data = {
    'custom': json.load(open(f'{W}/assets/custom.json')),
    'signet': json.load(open(f'{W}/assets/signet.json')),
    'spr': json.load(open(f'{W}/site/assets/spr/meta.json')),
}

page = open(f'{W}/src/template.html').read()
page = (page.replace('{{START}}', scrub(start))
            .replace('{{SIMPLE}}', scrub(simple))
            .replace('{{CUSTOM}}', scrub(custom))
            .replace('{{DATA}}', json.dumps(data).replace('</', '<\\/'))
            .replace('{{MAIN}}', open(f'{W}/src/main.js').read()))

hits = [k for k in LEAK if k in page]
if hits:
    raise SystemExit(f'personal data leak: {hits}')
open(f'{W}/site/index.html', 'w').write(page)
print('site/index.html', len(page))
