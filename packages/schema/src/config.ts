import { z } from 'zod';
import { LIMITS } from './limits';
import { PLATFORM_IDS, validateSocialUrl } from './platforms';
import { IMAGE_DATA_URL, isEmail, normalizeHex, toE164, toHttpsUrl } from './validate';

/* ------------------------------------------------------------------ primitives */

export const hexColor = z
  .string()
  .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Use a hex colour like #b34700')
  .transform(normalizeHex);

/** A solid hex colour or a two-stop gradient. */
export const paint = z.union([hexColor, z.object({ from: hexColor, to: hexColor })]);
export type Paint = z.output<typeof paint>;

/** An https link, normalised. */
export const httpsUrl = z
  .string()
  .max(2048)
  .transform((v, ctx) => {
    const href = toHttpsUrl(v);
    if (!href) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a valid https:// link' });
      return z.NEVER;
    }
    return href;
  });

export const imageDataUrl = z
  .string()
  .max(LIMITS.imageDataUrlChars, 'Image is too large')
  .regex(IMAGE_DATA_URL, 'Must be a base64 png, jpeg, webp or gif data URL');

const optionalText = (max: number) => z.string().trim().max(max).optional();

/* ------------------------------------------------------------------ enums */

export const INK_FONT_IDS = [
  'caveat',
  'dancing-script',
  'great-vibes',
  'allura',
  'sacramento',
  'homemade-apple',
  'yellowtail',
  'satisfy',
  'mr-dafoe',
  'marck-script',
] as const;
export type InkFontId = (typeof INK_FONT_IDS)[number];

export const AVATAR_ANIMATIONS = [
  'aurora',
  'strip-reveal',
  'pulse',
  'neon',
  'orbit',
  'equalizer',
  'none',
] as const;
export type AvatarAnimationId = (typeof AVATAR_ANIMATIONS)[number];

export const MARK_ANIMATIONS = ['ink', 'fade', 'none'] as const;
export type MarkAnimationId = (typeof MARK_ANIMATIONS)[number];

export const BANNER_KINDS = ['wave', 'ticker', 'shimmer', 'static'] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];

export const LAYOUT_IDS = [
  'card',
  'left-portrait',
  'editorial',
  'banner',
  'bordered',
  'stacked',
] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const PRESET_IDS = ['aurora', 'portrait', 'editorial', 'wave', 'neon', 'equalizer'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const FONT_FAMILIES = [
  'arial',
  'georgia',
  'verdana',
  'tahoma',
  'trebuchet',
  'times',
] as const;
export type FontFamilyId = (typeof FONT_FAMILIES)[number];

export const FIELD_KEYS = [
  'title',
  'department',
  'company',
  'phones',
  'email',
  'websites',
  'address',
  'tagline',
  'custom',
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/* ------------------------------------------------------------------ A. details */

const phone = z.object({
  label: z.string().trim().max(20).default(''),
  number: z
    .string()
    .trim()
    .max(30)
    .refine((v) => toE164(v) !== null, 'Use international format, e.g. +60 12 345 6789'),
});

const website = z.object({ label: z.string().trim().max(30).optional(), url: httpsUrl });

const customField = z.object({
  label: z.string().trim().min(1).max(30),
  value: z.string().trim().min(1).max(80),
  url: httpsUrl.optional(),
});

export const detailsSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Name is required').max(60),
    pronouns: optionalText(20),
    title: optionalText(80),
    department: optionalText(60),
    company: optionalText(80),
    companyUrl: httpsUrl.optional(),
    phones: z.array(phone).max(3).default([]),
    email: z.string().trim().refine(isEmail, 'Enter a valid email address').optional(),
    websites: z.array(website).max(2).default([]),
    address: z
      .object({
        text: z
          .string()
          .trim()
          .max(120)
          .refine((v) => v.split('\n').length <= 2, 'At most 2 lines'),
        mapUrl: httpsUrl.optional(),
      })
      .optional(),
    tagline: optionalText(90),
    customFields: z.array(customField).max(3).default([]),
    fieldOrder: z.array(z.enum(FIELD_KEYS)).default([...FIELD_KEYS]),
    hidden: z.array(z.enum(FIELD_KEYS)).default([]),
  })
  .default({ fullName: 'Your Name' });
export type Details = z.output<typeof detailsSchema>;

/* ------------------------------------------------------------------ B. avatar */

export const avatarSchema = z
  .object({
    source: z.enum(['photo', 'initials', 'logo']).default('initials'),
    image: imageDataUrl.optional(),
    initials: z.string().trim().max(3).optional(),
    crop: z
      .object({
        x: z.number().min(-1).max(1).default(0),
        y: z.number().min(-1).max(1).default(0),
        zoom: z.number().min(1).max(4).default(1),
        rotate: z.number().min(-180).max(180).default(0),
      })
      .default({}),
    shape: z.enum(['circle', 'rounded', 'square', 'squircle']).default('circle'),
    size: z.enum(['S', 'M', 'L']).default('M'),
    animation: z.enum(AVATAR_ANIMATIONS).default('aurora'),
    speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    ring: paint.optional(),
    filter: z.enum(['none', 'greyscale', 'duotone']).default('none'),
  })
  .default({});
export type Avatar = z.output<typeof avatarSchema>;

/* ------------------------------------------------------------------ C. mark */

/** A pen stroke in normalised coordinates (0..1 on both axes of the mark's box). */
export const strokeSchema = z
  .array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]))
  .min(2)
  .max(2000);
export type Stroke = z.output<typeof strokeSchema>;

export const markSchema = z
  .object({
    enabled: z.boolean().default(true),
    mode: z.enum(['typed', 'drawn', 'uploaded']).default('typed'),
    text: z.enum(['full', 'first', 'initials', 'custom']).default('full'),
    customText: optionalText(30),
    font: z.enum(INK_FONT_IDS).default('dancing-script'),
    color: paint.optional(),
    strokeWidth: z.enum(['thin', 'medium', 'bold']).default('medium'),
    animation: z.enum(MARK_ANIMATIONS).default('ink'),
    speed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    /** How long the finished mark is held before looping, ms. */
    holdMs: z.number().int().min(0).max(5000).default(1200),
    loop: z.enum(['forever', 'three']).default('forever'),
    size: z.enum(['S', 'M', 'L']).default('M'),
    position: z.enum(['above', 'beside', 'replace']).default('above'),
    /** Vector strokes for `drawn` / `uploaded` marks. */
    strokes: z.array(strokeSchema).max(200).optional(),
    /** Aspect ratio (w/h) of the drawn/uploaded strokes' box. */
    strokesAspect: z.number().min(0.2).max(12).optional(),
  })
  .default({});
export type Mark = z.output<typeof markSchema>;

/* ------------------------------------------------------------------ D. theme */

export const PALETTE_IDS = [
  'ember',
  'ocean',
  'sunset',
  'forest',
  'mono',
  'neon',
  'lavender',
  'rose',
  'slate',
  'gold',
  'mint',
  'berry',
] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export const themeSchema = z
  .object({
    accent: hexColor.default('#b34700'),
    secondary: hexColor.optional(),
    palette: z.enum(PALETTE_IDS).optional(),
    textColors: z
      .object({
        name: hexColor.default('#1c1b19'),
        title: hexColor.default('#57534e'),
        body: hexColor.default('#57534e'),
      })
      .default({}),
    background: z
      .union([z.enum(['transparent', 'white']), z.object({ color: hexColor })])
      .default('transparent'),
    darkMode: z.enum(['auto', 'force-dark-variant']).default('auto'),
  })
  .default({});
export type Theme = z.output<typeof themeSchema>;

/* ------------------------------------------------------------------ E. typography */

export const typographySchema = z
  .object({
    fontFamily: z.enum(FONT_FAMILIES).default('arial'),
    nameSize: z.number().int().min(14).max(24).default(16),
    bodySize: z.number().int().min(LIMITS.minFontPx).max(15).default(13),
    nameWeight: z.enum(['bold', 'regular']).default('bold'),
    nameCase: z.enum(['normal', 'upper', 'smallcaps']).default('normal'),
    titleCase: z.enum(['normal', 'upper', 'smallcaps']).default('normal'),
    letterSpacing: z.enum(['tight', 'normal', 'wide']).default('normal'),
    lineHeight: z.enum(['compact', 'normal', 'relaxed']).default('normal'),
    /** Bake the name into a GIF/PNG using the mark font (web fonts never load in mail clients). */
    displayName: z.boolean().default(false),
  })
  .default({});
export type Typography = z.output<typeof typographySchema>;

/* ------------------------------------------------------------------ F. socials */

const socialItem = z
  .object({
    platform: z.enum(PLATFORM_IDS),
    url: httpsUrl,
    label: optionalText(30),
    /** Uploaded icon for `custom` links. */
    customIcon: imageDataUrl.optional(),
  })
  .superRefine((v, ctx) => {
    const r = validateSocialUrl(v.platform, v.url);
    if (!r.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['url'], message: r.error });
  });
export type SocialItem = z.output<typeof socialItem>;

export const socialsSchema = z
  .object({
    items: z.array(socialItem).max(24).default([]),
    iconStyle: z.enum(['filled', 'outline', 'circle', 'square']).default('circle'),
    iconColor: z.enum(['brand', 'single']).default('single'),
    singleColor: hexColor.optional(),
    iconSize: z.union([z.literal(16), z.literal(20), z.literal(24), z.literal(32)]).default(24),
    spacing: z.enum(['tight', 'normal', 'wide']).default('normal'),
    position: z.enum(['below', 'beside', 'row']).default('below'),
    textLinks: z.boolean().default(false),
  })
  .default({});
export type Socials = z.output<typeof socialsSchema>;

/* ------------------------------------------------------------------ G. extras */

export const extrasSchema = z
  .object({
    banner: z
      .object({
        enabled: z.boolean().default(false),
        kind: z.enum(BANNER_KINDS).default('wave'),
        text: optionalText(60),
        url: httpsUrl.optional(),
        colorA: hexColor.optional(),
        colorB: hexColor.optional(),
        image: imageDataUrl.optional(),
        height: z.number().int().min(24).max(96).default(48),
      })
      .default({}),
    cta: z
      .object({
        enabled: z.boolean().default(false),
        label: z.string().trim().max(30).default('Book a call'),
        url: httpsUrl.optional(),
        background: hexColor.optional(),
        color: hexColor.default('#ffffff'),
      })
      .default({}),
    logo: z
      .object({
        enabled: z.boolean().default(false),
        image: imageDataUrl.optional(),
        width: z.number().int().min(24).max(160).default(80),
        animated: z.boolean().default(false),
        url: httpsUrl.optional(),
      })
      .default({}),
    badges: z
      .array(
        z.object({
          image: imageDataUrl,
          alt: z.string().trim().max(60).default(''),
          url: httpsUrl.optional(),
        }),
      )
      .max(4)
      .default([]),
    disclaimer: optionalText(800),
    greenNote: z.boolean().default(false),
    greenNoteText: optionalText(120),
    divider: z.enum(['none', 'line', 'dotted', 'gradient']).default('none'),
    spacing: z.enum(['compact', 'normal', 'airy']).default('normal'),
    alignment: z.enum(['left', 'center']).default('left'),
    madeWith: z.boolean().default(false),
  })
  .default({});
export type Extras = z.output<typeof extrasSchema>;

/* ------------------------------------------------------------------ H. layout */

export const SECTION_KEYS = [
  'avatar',
  'mark',
  'social',
  'banner',
  'cta',
  'disclaimer',
  'badges',
  'logo',
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const VARIANTS = ['full', 'reply', 'mobile'] as const;
export type VariantId = (typeof VARIANTS)[number];

const sectionsBase = z.object({
  avatar: z.boolean().default(true),
  mark: z.boolean().default(true),
  social: z.boolean().default(true),
  banner: z.boolean().default(true),
  cta: z.boolean().default(true),
  disclaimer: z.boolean().default(true),
  badges: z.boolean().default(true),
  logo: z.boolean().default(true),
});
const sectionsSchema = sectionsBase.default({});
/** Variant overrides only carry the keys they change (no defaults, or they'd override the base). */
const sectionsOverride = z
  .object({
    avatar: z.boolean(),
    mark: z.boolean(),
    social: z.boolean(),
    banner: z.boolean(),
    cta: z.boolean(),
    disclaimer: z.boolean(),
    badges: z.boolean(),
    logo: z.boolean(),
  })
  .partial();

export const layoutSchema = z
  .object({
    id: z.enum(LAYOUT_IDS).default('card'),
    width: z.enum(['mobile', 'wide']).default('mobile'),
    sections: sectionsSchema,
    variant: z.enum(VARIANTS).default('full'),
    /** Section/width overrides applied when a non-`full` variant is selected. */
    variants: z
      .object({
        reply: z
          .object({
            sections: sectionsOverride.optional(),
            width: z.enum(['mobile', 'wide']).optional(),
          })
          .default({
            sections: {
              mark: false,
              banner: false,
              cta: false,
              disclaimer: false,
              badges: false,
              logo: false,
            },
          }),
        mobile: z
          .object({
            sections: sectionsOverride.optional(),
            width: z.enum(['mobile', 'wide']).optional(),
          })
          .default({ width: 'mobile' }),
      })
      .default({}),
  })
  .default({});
export type Layout = z.output<typeof layoutSchema>;

/* ------------------------------------------------------------------ root */

export const SCHEMA_VERSION = 1 as const;

export const signatureConfigSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  name: optionalText(80),
  presetId: z.enum(PRESET_IDS).optional(),
  details: detailsSchema,
  avatar: avatarSchema,
  mark: markSchema,
  theme: themeSchema,
  typography: typographySchema,
  socials: socialsSchema,
  extras: extrasSchema,
  layout: layoutSchema,
});

export type SignatureConfig = z.output<typeof signatureConfigSchema>;
export type SignatureConfigInput = z.input<typeof signatureConfigSchema>;

/** Parse and fill defaults; throws a ZodError on invalid input. */
export function createConfig(input: SignatureConfigInput): SignatureConfig {
  return signatureConfigSchema.parse(input);
}

export function safeParseConfig(input: unknown) {
  return signatureConfigSchema.safeParse(input);
}
