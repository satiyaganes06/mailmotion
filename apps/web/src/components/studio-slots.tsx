'use client';

import type { ComponentType } from 'react';

/**
 * Extension points filled by later features so each can land as its own change:
 * extra editor panels (avatar, mark, theme, socials, extras) and the install/export panel.
 */
export const EXTRA_PANELS: ComponentType[] = [];

export function RightPanels() {
  return null;
}
