import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createFromPreset, PRESET_LIST } from '@mailmotion/presets';
import {
  buildBundle,
  checkGifBudget,
  renderSignatureAssets,
  toSignatureAssets,
  uniqueFiles,
} from '@mailmotion/renderer';
import { createNodeEnv } from '@mailmotion/renderer/node';
import {
  LIMITS,
  PRESET_IDS,
  VARIANTS,
  exportConfig,
  importConfig,
  type PresetId,
  type SignatureConfig,
  type VariantId,
} from '@mailmotion/schema';
import {
  analyzeSignature,
  fileBaseName,
  serializeSignature,
  toHtmDocument,
  toMailSignature,
} from '@mailmotion/serializer';
import { createHttpAdapter } from '@mailmotion/storage';
import { randomUUID } from 'node:crypto';

export interface IO {
  out: (s: string) => void;
  err: (s: string) => void;
  cwd: string;
  env: Record<string, string | undefined>;
}

const HELP = `mailmotion: animated email signatures from JSON

Usage
  mailmotion init [--preset <id>] [--name "Ada Lovelace"] [--out signature.json]
  mailmotion validate <config.json>
  mailmotion render <config.json> [options]
  mailmotion presets

render options
  --out <dir>           Output directory (default ./mailmotion-out)
  --base-url <url>      Where the images will be hosted (https). Default: a clearly fake placeholder
  --upload <endpoint>   Upload images to a MailMotion storage server (token from --token or MM_UPLOAD_TOKEN);
                        the HTML then uses the URLs the server returns
  --token <token>       Upload token for --upload
  --variant <v>         full | reply | mobile (default: the config's variant)
  --zip                 Also write a ZIP bundle (images, HTML, config, README)
  --check               Exit with code 1 if any budget is exceeded (10,000 chars, 300 KB per GIF, 12 fps)
  --json                Print a machine-readable report on stdout

Exit codes: 0 ok, 1 budget/validation failure, 2 usage error.
`;

class Usage extends Error {}

function fontsDir(): string | undefined {
  // Bundled build: fonts sit next to the script. In the monorepo, the ink package provides them.
  const here = join(dirname(fileURLToPath(import.meta.url)), 'fonts');
  return existsSync(here) ? here : undefined;
}

async function loadConfig(path: string, cwd: string): Promise<SignatureConfig> {
  let text: string;
  try {
    text = await readFile(resolve(cwd, path), 'utf8');
  } catch {
    throw new Usage(`Cannot read ${path}`);
  }
  const r = importConfig(text);
  if (!r.ok) throw new ConfigError(r.errors);
  return r.config;
}

class ConfigError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid config:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

export async function run(argv: string[], io: IO): Promise<number> {
  try {
    const [cmd, ...rest] = argv;
    switch (cmd) {
      case undefined:
      case '-h':
      case '--help':
      case 'help':
        io.out(HELP);
        return cmd === undefined ? 2 : 0;
      case 'presets':
        for (const p of PRESET_LIST)
          io.out(`${p.id.padEnd(10)} ${p.name.padEnd(10)} ${p.layout.padEnd(14)} ${p.bestFor}`);
        return 0;
      case 'init':
        return await init(rest, io);
      case 'validate':
        return await validate(rest, io);
      case 'render':
        return await render(rest, io);
      default:
        throw new Usage(`Unknown command: ${cmd}`);
    }
  } catch (e) {
    if (e instanceof Usage) {
      io.err(`${e.message}\n\n${HELP}`);
      return 2;
    }
    if (e instanceof ConfigError) {
      io.err(e.message);
      return 1;
    }
    io.err(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

function opts<T extends Record<string, { type: 'string' | 'boolean' }>>(
  args: string[],
  options: T,
) {
  try {
    return parseArgs({ args, options, allowPositionals: true });
  } catch (e) {
    throw new Usage((e as Error).message);
  }
}

async function init(args: string[], io: IO): Promise<number> {
  const { values } = opts(args, {
    preset: { type: 'string' },
    name: { type: 'string' },
    out: { type: 'string' },
  });
  const preset = (values.preset ?? 'aurora') as PresetId;
  if (!PRESET_IDS.includes(preset))
    throw new Usage(`Unknown preset "${preset}". Try: ${PRESET_IDS.join(', ')}`);
  const cfg = createFromPreset(preset, {
    fullName: values.name ?? 'Your Name',
    title: 'Your Title',
    company: 'Your Company',
    email: 'you@example.com',
  });
  const out = resolve(io.cwd, values.out ?? 'signature.json');
  if (existsSync(out)) throw new Usage(`${out} already exists; choose another --out`);
  await writeFile(out, exportConfig(cfg));
  io.out(`Wrote ${out}. Edit it, then run: mailmotion render ${values.out ?? 'signature.json'}`);
  return 0;
}

async function validate(args: string[], io: IO): Promise<number> {
  const { positionals } = opts(args, {});
  if (!positionals[0]) throw new Usage('validate needs a config file');
  const cfg = await loadConfig(positionals[0], io.cwd);
  const a = analyzeSignature(cfg);
  io.out(`OK: ${cfg.details.fullName} (${cfg.layout.id} layout)`);
  io.out(
    `HTML: ${a.chars.toLocaleString('en-US')} / ${LIMITS.htmlChars.toLocaleString('en-US')} characters (${a.charStatus})`,
  );
  for (const w of a.warnings) io.out(`warning: ${w}`);
  for (const c of a.contrast)
    io.out(
      `warning: ${c.field} colour ${c.chosen} ${c.problem === 'light' ? `fails 4.5:1 (suggest ${c.suggested})` : 'is weak in dark mode'}`,
    );
  return a.canExportGmail ? 0 : 1;
}

async function render(args: string[], io: IO): Promise<number> {
  const { values, positionals } = opts(args, {
    out: { type: 'string' },
    'base-url': { type: 'string' },
    upload: { type: 'string' },
    token: { type: 'string' },
    variant: { type: 'string' },
    zip: { type: 'boolean' },
    check: { type: 'boolean' },
    json: { type: 'boolean' },
  });
  if (!positionals[0]) throw new Usage('render needs a config file');
  let cfg = await loadConfig(positionals[0], io.cwd);
  if (values.variant) {
    if (!VARIANTS.includes(values.variant as VariantId))
      throw new Usage(`--variant must be one of ${VARIANTS.join(', ')}`);
    cfg = { ...cfg, layout: { ...cfg.layout, variant: values.variant as VariantId } };
  }
  const out = resolve(io.cwd, values.out ?? 'mailmotion-out');
  const imagesDir = join(out, 'images');
  await mkdir(imagesDir, { recursive: true });

  const env = createNodeEnv({ fontsDir: fontsDir() });
  const rendered = await renderSignatureAssets(cfg, env, {
    onProgress: (d, t, id) => !values.json && io.err(`  rendered ${d}/${t}  ${id}`),
  });
  const files = uniqueFiles(rendered);
  for (const [name, r] of files) await writeFile(join(imagesDir, name), r.bytes);

  // Where will the images live?
  let assets = toSignatureAssets(
    rendered,
    values['base-url'] ?? 'https://your-host.example/mailmotion',
  );
  if (values['base-url'] && !/^https:\/\//i.test(values['base-url']))
    throw new Usage('--base-url must start with https://');
  if (values.upload) {
    const token = values.token ?? io.env.MM_UPLOAD_TOKEN;
    if (!token) throw new Usage('--upload needs --token or MM_UPLOAD_TOKEN');
    const adapter = createHttpAdapter({ endpoint: values.upload, token });
    const urls = new Map<string, string>();
    for (const [name, r] of files) {
      const s = await adapter.put({
        name,
        bytes: r.bytes,
        contentType: r.format === 'gif' ? 'image/gif' : 'image/png',
      });
      urls.set(name, s.url);
    }
    assets = {
      slots: Object.fromEntries(
        rendered.map((r) => [
          r.slotId,
          { url: urls.get(r.fileName)!, width: r.width, height: r.height },
        ]),
      ),
    };
    io.err(`  uploaded ${urls.size} images to ${values.upload}`);
  }

  const result = serializeSignature(cfg, assets);
  const base = fileBaseName(cfg.name ?? cfg.details.fullName);
  await writeFile(join(out, `${base}.html`), result.html);
  await writeFile(join(out, `${base}.htm`), toHtmDocument(result.html, cfg.details.fullName));
  await writeFile(join(out, `${base}.mailsignature`), toMailSignature(result.html, randomUUID()));
  await writeFile(join(out, `${base}.mailmotion.json`), exportConfig(cfg));
  if (values.zip)
    await writeFile(
      join(out, `${base}.zip`),
      buildBundle(cfg, rendered, { baseUrl: values['base-url'] }).zip,
    );

  // budgets
  const problems: string[] = [];
  if (result.chars > LIMITS.htmlChars)
    problems.push(`HTML is ${result.chars} characters (limit ${LIMITS.htmlChars})`);
  for (const issue of result.issues) problems.push(`lint: ${issue.rule}: ${issue.message}`);
  const gifs = [...files.values()].filter((f) => f.format === 'gif');
  for (const g of gifs)
    for (const p of checkGifBudget(g.bytes).problems) problems.push(`${g.slotId}: ${p}`);

  const report = {
    out,
    signature: `${base}.html`,
    chars: result.chars,
    images: [...files.values()].map((f) => ({
      file: `images/${f.fileName}`,
      slot: f.slotId,
      kind: f.kind,
      bytes: f.bytes.length,
      frames: f.frames,
      degraded: f.degraded,
    })),
    problems,
  };
  if (values.json) io.out(JSON.stringify(report, null, 2));
  else {
    io.out(`\nWrote ${out}`);
    io.out(
      `  ${base}.html  ${result.chars.toLocaleString('en-US')} / ${LIMITS.htmlChars.toLocaleString('en-US')} characters`,
    );
    for (const f of files.values())
      io.out(
        `  images/${f.fileName.slice(0, 12)}…${f.format}  ${f.slotId.padEnd(9)} ${kb(f.bytes.length).padStart(9)}${f.format === 'gif' ? `  ${f.frames} frames` : ''}${f.degraded.length ? `  (reduced: ${f.degraded.join(', ')})` : ''}`,
      );
    if (!values['base-url'] && !values.upload)
      io.out(
        '\nNote: the HTML uses a placeholder image address. Upload images/ somewhere public and re-run with --base-url, or use --upload.',
      );
    for (const p of problems) io.out(`problem: ${p}`);
  }
  return values.check && problems.length ? 1 : 0;
}
