import subprocess, os

A = '/Users/sivajipro/.claude/plugins/cache/brag/brag/0.4.0/skills/brag/assets'
OUT = os.path.join(os.path.dirname(__file__), '..', 'audio.wav')
DUR = 24.2
MUSIC = f'{A}/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3'

swish = ('casino/card-slide-1.ogg', 'lowpass=f=4200')
ev = [  # (file, time, gain, extra filter)
    ('impact/impactSoft_medium_001.ogg', 1.58, 0.55, ''),
    (*swish[:1], 3.58, 0.30, swish[1]),
    ('ui/click2.ogg', 5.12, 0.55, ''),
    (*swish[:1], 5.34, 0.26, swish[1]),
    ('interface/click_003.ogg', 7.10, 0.7, ''),
    (*swish[:1], 8.96, 0.20, swish[1]),
    ('ui/click2.ogg', 11.55, 0.55, ''),
    ('interface/bong_001.ogg', 11.66, 0.28, ''),
    (*swish[:1], 12.30, 0.28, swish[1]),
    ('interface/click_003.ogg', 13.70, 0.7, ''),
    ('interface/click_003.ogg', 14.76, 0.7, ''),
    ('interface/click_003.ogg', 15.81, 0.7, ''),
    (*swish[:1], 17.55, 0.28, swish[1]),
    ('interface/bong_001.ogg', 18.44, 0.30, ''),
    ('interface/bong_001.ogg', 18.96, 0.30, 'asetrate=48000*1.12246,aresample=48000'),
    ('interface/bong_001.ogg', 19.49, 0.32, 'asetrate=48000*1.25992,aresample=48000'),
    ('impact/impactSoft_heavy_002.ogg', 20.54, 0.5, 'lowpass=f=6000'),
    ('ui/rollover2.ogg', 21.62, 0.3, ''),
]
for i in range(12):  # "Satiya Ganes" typed at 7.25 + i*0.068
    if 'Satiya Ganes'[i] == ' ':
        continue
    ev.append((f'keyboard/keypress-{(i % 8) + 1:03d}.wav', 7.25 + i * 0.068, 0.22 + 0.04 * (i % 3), 'lowpass=f=7000'))

inputs = ['-i', MUSIC]
fc = [f'[0:a]atrim=0:{DUR},asetpts=N/SR/TB,aformat=sample_rates=48000:channel_layouts=stereo,'
      f'volume=0.82,afade=t=in:d=0.12,afade=t=out:st={DUR - 1.3}:d=1.3[m]']
labels = []
for k, (f, t, g, x) in enumerate(ev, start=1):
    inputs += ['-i', f'{A}/sfx/{f}']
    chain = f'[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo'
    if x:
        chain += f',{x}'
    ms = int(t * 1000)
    chain += f',volume={g},adelay={ms}|{ms},apad=whole_dur={DUR}[s{k}]'
    fc.append(chain)
    labels.append(f'[s{k}]')
fc.append(f'{"".join(labels)}amix=inputs={len(labels)}:normalize=0,highpass=f=110,'
          f'aecho=0.85:0.55:38|67:0.16|0.10[fx]')
fc.append(f'[m][fx]amix=inputs=2:normalize=0,atrim=0:{DUR},'
          'loudnorm=I=-14:TP=-1.5:LRA=11[out]')
cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs,
       '-filter_complex', ';'.join(fc), '-map', '[out]', '-ar', '48000', OUT]
subprocess.run(cmd, check=True)
print('audio ->', os.path.abspath(OUT))
