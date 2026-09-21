import { describe, expect, it } from 'vitest';
import { PRESET_IDS } from '@mailmotion/schema';
import { checkGifBudget, inspectGif, renderSignatureAssets } from '../src';
import { dumpContactSheet, env, sample, writeAsset } from './helpers';

describe('renderSignatureAssets: the six designs', () => {
  it.each(PRESET_IDS)(
    '%s renders every planned slot within the GIF budgets',
    async (id) => {
      const cfg = sample(id);
      const assets = await renderSignatureAssets(cfg, env);
      expect(assets.length).toBeGreaterThan(3);
      for (const a of assets) {
        expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
        expect(a.fileName).toBe(`${a.hash}.${a.format}`);
        if (a.format === 'gif') {
          const check = checkGifBudget(a.bytes);
          expect(check.problems, `${id}/${a.slotId}`).toEqual([]);
          expect(a.fitsBudget).toBe(true);
          dumpContactSheet(`${id}-${a.slotId}`, a.bytes);
          writeAsset(`${id}-${a.slotId}.gif`, a.bytes);
        } else {
          // PNG magic
          expect([...a.bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
          writeAsset(`${id}-${a.slotId.replace(':', '_')}.png`, a.bytes);
        }
      }
    },
    60_000,
  );

  it('is deterministic: same config, same hashes', async () => {
    const a = await renderSignatureAssets(sample('aurora'), env);
    const b = await renderSignatureAssets(sample('aurora'), env);
    expect(a.map((x) => x.hash)).toEqual(b.map((x) => x.hash));
  }, 60_000);

  it('animated GIFs loop forever and have at most 12 fps', async () => {
    const assets = await renderSignatureAssets(sample('wave'), env);
    const gifs = assets.filter((a) => a.format === 'gif');
    expect(gifs.length).toBeGreaterThanOrEqual(3); // avatar, mark, banner
    for (const g of gifs) {
      const info = inspectGif(g.bytes);
      expect(info.frames).toBeGreaterThan(1);
      expect(info.loopCount).toBe(0);
      expect(info.maxFps).toBeLessThanOrEqual(12);
    }
  }, 60_000);
});
