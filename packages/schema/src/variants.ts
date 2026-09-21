import type { SectionKey, SignatureConfig, VariantId } from './config';

/**
 * Apply a saved variant ("full" / "reply" / "mobile") to a config and return the effective
 * section toggles and width. The base config is never mutated.
 */
export function resolveVariant(
  config: SignatureConfig,
  variant: VariantId = config.layout.variant,
): SignatureConfig {
  if (variant === 'full') return config;
  const override = config.layout.variants[variant];
  const sections = { ...config.layout.sections, ...(override.sections ?? {}) } as Record<
    SectionKey,
    boolean
  >;
  return {
    ...config,
    layout: {
      ...config.layout,
      variant,
      width: override.width ?? config.layout.width,
      sections,
    },
  };
}
