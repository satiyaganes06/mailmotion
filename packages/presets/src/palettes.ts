import type { PaletteId } from '@mailmotion/schema';

export interface Palette {
  id: PaletteId;
  name: string;
  accent: string;
  secondary: string;
}

export const PALETTES: Record<PaletteId, Palette> = {
  ember: { id: 'ember', name: 'Ember', accent: '#b34700', secondary: '#e2793d' },
  ocean: { id: 'ocean', name: 'Ocean', accent: '#0369a1', secondary: '#06b6d4' },
  sunset: { id: 'sunset', name: 'Sunset', accent: '#c2410c', secondary: '#f59e0b' },
  forest: { id: 'forest', name: 'Forest', accent: '#166534', secondary: '#65a30d' },
  mono: { id: 'mono', name: 'Mono', accent: '#27272a', secondary: '#71717a' },
  neon: { id: 'neon', name: 'Neon', accent: '#7c3aed', secondary: '#e879f9' },
  lavender: { id: 'lavender', name: 'Lavender', accent: '#6d28d9', secondary: '#a78bfa' },
  rose: { id: 'rose', name: 'Rose', accent: '#be123c', secondary: '#fb7185' },
  slate: { id: 'slate', name: 'Slate', accent: '#334155', secondary: '#94a3b8' },
  gold: { id: 'gold', name: 'Gold', accent: '#a16207', secondary: '#eab308' },
  mint: { id: 'mint', name: 'Mint', accent: '#0f766e', secondary: '#34d399' },
  berry: { id: 'berry', name: 'Berry', accent: '#9d174d', secondary: '#c084fc' },
};

export const PALETTE_LIST = Object.values(PALETTES);
