'use client';

import type { ComponentType } from 'react';
import { AvatarPanel } from './panels/AvatarPanel';
import { ExtrasPanel } from './panels/ExtrasPanel';
import { MarkPanel } from './panels/MarkPanel';
import { SocialsPanel } from './panels/SocialsPanel';
import { ThemePanel } from './panels/ThemePanel';

/**
 * Extension points so features can land independently: the editor panels after "Design" and
 * "Details", and the install/export panel in the workspace column.
 */
export const EXTRA_PANELS: ComponentType[] = [
  AvatarPanel,
  MarkPanel,
  ThemePanel,
  SocialsPanel,
  ExtrasPanel,
];

export function RightPanels() {
  return null;
}
