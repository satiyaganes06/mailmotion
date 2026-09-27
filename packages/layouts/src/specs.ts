import type { LayoutId } from '@mailmotion/schema';

export interface LayoutSpec {
  id: LayoutId;
  label: string;
  description: string;
  /** Where the avatar sits relative to the text. */
  avatar: 'left' | 'top' | 'head';
  /** Default text alignment. */
  align: 'left' | 'center';
  /** Whether a vertical rule separates avatar and text. */
  rule: 'none' | 'thin' | 'thick';
  /** Layouts whose alignment the user may switch (plan §4.2 G). */
  alignable: boolean;
}

export const LAYOUT_SPECS: Record<LayoutId, LayoutSpec> = {
  card: {
    id: 'card',
    label: 'Card',
    description: 'Avatar on the left, a hairline rule, then the details.',
    avatar: 'left',
    align: 'left',
    rule: 'thin',
    alignable: false,
  },
  'left-portrait': {
    id: 'left-portrait',
    label: 'Left Portrait',
    description: 'Photo-led: the portrait sits beside the details.',
    avatar: 'left',
    align: 'left',
    rule: 'none',
    alignable: false,
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    description: 'A large ink signature headlines the block; details sit beneath.',
    avatar: 'head',
    align: 'left',
    rule: 'none',
    alignable: true,
  },
  banner: {
    id: 'banner',
    label: 'Banner',
    description: 'Avatar and details on top, a full-width colour strip below.',
    avatar: 'left',
    align: 'left',
    rule: 'none',
    alignable: false,
  },
  bordered: {
    id: 'bordered',
    label: 'Bordered',
    description: 'Avatar, a bold accent rule, then the details.',
    avatar: 'left',
    align: 'left',
    rule: 'thick',
    alignable: false,
  },
  stacked: {
    id: 'stacked',
    label: 'Stacked',
    description: 'One centred column: built for narrow reply chains and phones.',
    avatar: 'top',
    align: 'center',
    rule: 'none',
    alignable: true,
  },
};

export const LAYOUT_LIST = Object.values(LAYOUT_SPECS);

export function getLayoutSpec(id: LayoutId): LayoutSpec {
  return LAYOUT_SPECS[id];
}
