#!/usr/bin/env node
/**
 * Bundle Size Baseline Checker (E64-S03)
 *
 * Compares the current production bundle (dist/) against a committed baseline
 * (docs/reviews/performance/bundle-baseline.json). Exits non-zero if the
 * initial-load gzipped size has grown by more than the configured threshold.
 *
 * Usage:
 *   node scripts/bundle-check.js              # Compare against baseline
 *   node scripts/bundle-check.js --update     # Write current metrics as new baseline
 *   node scripts/bundle-check.js --json       # Emit machine-readable JSON to stdout
 *
 * Pre-req: npm run build has produced dist/index.html and dist/assets/.
 * No external dependencies — uses only Node built-ins (fs, path, zlib).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const BASELINE_PATH = path.join(
  REPO_ROOT,
  'docs',
  'reviews',
  'performance',
  'bundle-baseline.json'
);

const REGRESSION_THRESHOLD = 0.10; // 10% over baseline triggers exit 1
const TOP_CHUNK_COUNT = 10;

const useColor = process.stdout.isTTY;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = (s) => c('31', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const bold = (s) => c('1', s);

const args = new Set(process.argv.slice(2));
const UPDATE_MODE = args.has('--update');
const JSON_MODE = args.has('--json');

function fail(msg) {
  console.error(red(`x ${msg}`));
  process.exit(1);
}

function gzippedSize(filePath) {
  return zlib.gzipSync(fs.readFileSync(filePath)).length;
}

function readViteVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
    );
    return (
      pkg.devDependencies?.vite ||
      pkg.dependencies?.vite ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

function parseModulePreloads(html) {
  const re = /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g;
  const hrefs = [];
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

function parseInitialScripts(html) {
  const re = /<script[^>]+type="module"[^>]+src="([^"]+)"/g;
  const srcs = [];
  let m;
  while ((m = re.exec(html)) !== null) srcs.push(m[1]);
  return srcs;
}

function parseStylesheets(html) {
  const re = /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g;
  const hrefs = [];
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return hrefs;
}

function relAssetPath(href) {
  if (href.startsWith('/')) return path.join(DIST_DIR, href);
  return path.join(DIST_DIR, href);
}

function collectMetrics() {
  if (!fs.existsSync(INDEX_HTML)) {
    fail('dist/index.html not found. Run npm run build first.');
  }
  const html = fs.readFileSync(INDEX_HTML, 'utf8');

  const preloads = parseModulePreloads(html);
  const entryScripts = parseInitialScripts(html);
  const stylesheets = parseStylesheets(html);

  const initialJsHrefs = [...new Set([...entryScripts, ...preloads])];
  let initialJsRaw = 0;
  let initialJsGzipped = 0;
  for (const href of initialJsHrefs) {
    const file = relAssetPath(href);
    if (fs.existsSync(file)) {
      initialJsRaw += fs.statSync(file).size;
      initialJsGzipped += gzippedSize(file);
    }
  }

  let initialCssRaw = 0;
  let initialCssGzipped = 0;
  for (const href of stylesheets) {
    const file = relAssetPath(href);
    if (fs.existsSync(file)) {
      initialCssRaw += fs.statSync(file).size;
      initialCssGzipped += gzippedSize(file);
    }
  }

  const allFiles = fs
    .readdirSync(ASSETS_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(ASSETS_DIR, f));

  let totalJsRaw = 0;
  let totalJsGzipped = 0;
  const chunks = [];
  for (const file of allFiles) {
    const raw = fs.statSync(file).size;
    const gz = gzippedSize(file);
    totalJsRaw += raw;
    totalJsGzipped += gz;
    chunks.push({
      name: path.basename(file).replace(/-[A-Za-z0-9_-]+\.js$/, ''),
      raw,
      gzipped: gz,
    });
  }
  chunks.sort((a, b) => b.gzipped - a.gzipped);

  return {
    generatedAt: new Date().toISOString(),
    viteVersion: readViteVersion(),
    initialLoad: {
      jsRaw: initialJsRaw,
      jsGzipped: initialJsGzipped,
      cssRaw: initialCssRaw,
      cssGzipped: initialCssGzipped,
      totalGzipped: initialJsGzipped + initialCssGzipped,
      modulePreloadCount: preloads.length,
      entryScriptCount: entryScripts.length,
    },
    totalBundle: {
      jsRaw: totalJsRaw,
      jsGzipped: totalJsGzipped,
      chunkCount: allFiles.length,
    },
    topChunks: chunks.slice(0, TOP_CHUNK_COUNT).map((ch) => ({
      name: ch.name,
      gzipped: ch.gzipped,
    })),
  };
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function pct(current, baseline) {
  if (!baseline) return 'n/a';
  const delta = (current - baseline) / baseline;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)}%`;
}

function deltaCell(current, baseline) {
  if (baseline == null) return yellow('new');
  const delta = current - baseline;
  const pctStr = pct(current, baseline);
  if (Math.abs(delta) < 1024) return `${pctStr}`;
  if (delta > 0) return red(`+${fmtKB(delta)} (${pctStr})`);
  return green(`${fmtKB(delta)} (${pctStr})`);
}

function renderHumanReport(current, baseline) {
  const lines = [];
  lines.push(bold('Bundle Size Comparison'));
  lines.push('');
  if (baseline) {
    lines.push(`  Baseline: ${baseline.generatedAt} (vite ${baseline.viteVersion})`);
  } else {
    lines.push(yellow('  No baseline found - current metrics shown only.'));
  }
  lines.push(`  Current:  ${current.generatedAt} (vite ${current.viteVersion})`);
  lines.push('');
  lines.push(bold('Initial load (gzipped):'));
  lines.push(
    `  JS:    ${fmtKB(current.initialLoad.jsGzipped).padStart(10)}   ${deltaCell(
      current.initialLoad.jsGzipped,
      baseline?.initialLoad?.jsGzipped
    )}`
  );
  lines.push(
    `  CSS:   ${fmtKB(current.initialLoad.cssGzipped).padStart(10)}   ${deltaCell(
      current.initialLoad.cssGzipped,
      baseline?.initialLoad?.cssGzipped
    )}`
  );
  lines.push(
    `  Total: ${fmtKB(current.initialLoad.totalGzipped).padStart(10)}   ${deltaCell(
      current.initialLoad.totalGzipped,
      baseline?.initialLoad?.totalGzipped
    )}`
  );
  lines.push(
    `  modulepreload count: ${current.initialLoad.modulePreloadCount}` +
      (baseline
        ? ` (baseline: ${baseline.initialLoad.modulePreloadCount})`
        : '')
  );
  lines.push('');
  lines.push(bold('Total bundle:'));
  lines.push(
    `  JS gzipped:  ${fmtKB(current.totalBundle.jsGzipped).padStart(10)}   ${deltaCell(
      current.totalBundle.jsGzipped,
      baseline?.totalBundle?.jsGzipped
    )}`
  );
  lines.push(
    `  Chunk count: ${String(current.totalBundle.chunkCount).padStart(5)}` +
      (baseline ? `   (baseline: ${baseline.totalBundle.chunkCount})` : '')
  );

  if (baseline?.topChunks?.length) {
    lines.push('');
    lines.push(bold('Top chunk diffs (gzipped):'));
    const baselineByName = new Map(
      baseline.topChunks.map((ch) => [ch.name, ch.gzipped])
    );
    for (const ch of current.topChunks) {
      const base = baselineByName.get(ch.name);
      lines.push(
        `  ${ch.name.padEnd(28)} ${fmtKB(ch.gzipped).padStart(10)}   ${deltaCell(
          ch.gzipped,
          base
        )}`
      );
    }
  }
  return lines.join('\n');
}

function main() {
  const current = collectMetrics();

  if (UPDATE_MODE) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
    fs.writeFileSync(
      BASELINE_PATH,
      JSON.stringify(current, null, 2) + '\n'
    );
    console.log(green(`Baseline updated: ${path.relative(REPO_ROOT, BASELINE_PATH)}`));
    console.log('');
    console.log(renderHumanReport(current, null));
    process.exit(0);
  }

  let baseline = null;
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    } catch (err) {
      fail(`Failed to parse baseline JSON: ${err.message}`);
    }
  }

  if (JSON_MODE) {
    const baselineTotal = baseline?.initialLoad?.totalGzipped;
    const delta = baselineTotal
      ? (current.initialLoad.totalGzipped - baselineTotal) / baselineTotal
      : 0;
    const status = baseline
      ? delta > REGRESSION_THRESHOLD
        ? 'regression'
        : delta > REGRESSION_THRESHOLD / 2
          ? 'warning'
          : 'pass'
      : 'no-baseline';
    process.stdout.write(
      JSON.stringify(
        {
          status,
          delta,
          threshold: REGRESSION_THRESHOLD,
          current,
          baseline,
        },
        null,
        2
      ) + '\n'
    );
    process.exit(status === 'regression' ? 1 : 0);
  }

  if (!baseline) {
    console.log(
      yellow(
        `No baseline at ${path.relative(REPO_ROOT, BASELINE_PATH)}. Run: node scripts/bundle-check.js --update`
      )
    );
    console.log('');
    console.log(renderHumanReport(current, null));
    process.exit(0);
  }

  const baselineTotal = baseline.initialLoad?.totalGzipped ?? 0;
  const delta = baselineTotal
    ? (current.initialLoad.totalGzipped - baselineTotal) / baselineTotal
    : 0;

  console.log(renderHumanReport(current, baseline));
  console.log('');

  if (delta > REGRESSION_THRESHOLD) {
    console.log(
      red(
        `REGRESSION: initial load grew ${pct(current.initialLoad.totalGzipped, baselineTotal)} (threshold: +${(REGRESSION_THRESHOLD * 100).toFixed(0)}%).`
      )
    );
    console.log(
      '  Update the baseline intentionally with: node scripts/bundle-check.js --update'
    );
    process.exit(1);
  }

  if (delta > REGRESSION_THRESHOLD / 2) {
    console.log(
      yellow(
        `Initial load grew ${pct(current.initialLoad.totalGzipped, baselineTotal)} (within ${(REGRESSION_THRESHOLD * 100).toFixed(0)}% threshold).`
      )
    );
  } else {
    console.log(
      green(
        `Bundle within ${(REGRESSION_THRESHOLD * 100).toFixed(0)}% threshold (${pct(current.initialLoad.totalGzipped, baselineTotal)}).`
      )
    );
  }
  process.exit(0);
}

main();
