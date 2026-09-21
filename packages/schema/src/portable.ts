import { SCHEMA_VERSION, signatureConfigSchema, type SignatureConfig } from './config';

/** Portable file format: `.mailmotion.json` (also accepted by the CLI). */
export interface PortableSignature {
  format: 'mailmotion.signature';
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  config: SignatureConfig;
}

export function exportConfig(config: SignatureConfig, now: Date = new Date()): string {
  const out: PortableSignature = {
    format: 'mailmotion.signature',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    config,
  };
  return JSON.stringify(out, null, 2);
}

export type ImportResult = { ok: true; config: SignatureConfig } | { ok: false; errors: string[] };

/**
 * Import a portable JSON string. Accepts either the wrapped format or a bare config object.
 * Unknown/future schema versions are rejected instead of guessed at.
 */
export function importConfig(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, errors: ['Not valid JSON'] };
  }
  if (typeof data !== 'object' || data === null)
    return { ok: false, errors: ['Expected a JSON object'] };
  const obj = data as Record<string, unknown>;
  const candidate = obj.format === 'mailmotion.signature' ? obj.config : obj;
  const version = (candidate as { schemaVersion?: unknown } | null)?.schemaVersion;
  if (version !== undefined && version !== SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [`Unsupported schemaVersion ${String(version)} (expected ${SCHEMA_VERSION})`],
    };
  }
  const parsed = signatureConfigSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  return { ok: true, config: parsed.data };
}
