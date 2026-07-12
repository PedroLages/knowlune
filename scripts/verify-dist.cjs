#!/usr/bin/env node

/**
 * verify-dist.cjs — Post-build asset integrity verification
 *
 * Parses dist/index.html, dist/.vite/manifest.json, and ALL JavaScript files
 * in dist/assets/ to verify that every referenced asset actually exists.
 *
 * Unlike the previous version that only scanned select entry chunks, this
 * version performs recursive dependency graph verification across every
 * emitted JavaScript file. It catches missing chunk references that would
 * cause "Failed to fetch dynamically imported module" errors in production.
 *
 * Also verifies CSS references inside JS chunks and worker URLs.
 *
 * Usage: node scripts/verify-dist.cjs
 * Exit: 0 if all references resolve, 1 if any are broken.
 */

const fs = require('fs')
const path = require('path')

const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')
const MANIFEST_JSON = path.join(DIST_DIR, '.vite', 'manifest.json')

// ─── Helpers ────────────────────────────────────────────────────────────────

function fileExists(filePath) {
  return fs.existsSync(path.join(DIST_DIR, filePath))
}

function normalizeAssetPath(src, baseDir = '') {
  // Remove leading ./ or /
  let normalized = src.replace(/^\.?\//, '')
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }
  // Resolve relative to baseDir
  if (baseDir && !normalized.startsWith('assets/')) {
    normalized = path.join(baseDir, normalized)
  }
  // Normalize any .. or redundant segments
  if (normalized.includes('/')) {
    normalized = path.normalize(normalized)
  }
  return normalized
}

// ─── Get all JS/CSS files in dist/assets ────────────────────────────────────

function findAllDistFiles() {
  const assetsDir = path.join(DIST_DIR, 'assets')
  if (!fs.existsSync(assetsDir)) return []

  return fs.readdirSync(assetsDir).map(f => path.join('assets', f))
}

function findAllJsFiles() {
  const assetsDir = path.join(DIST_DIR, 'assets')
  if (!fs.existsSync(assetsDir)) return []

  return fs
    .readdirSync(assetsDir)
    .filter(f => f.endsWith('.js'))
    .map(f => path.join('assets', f))
}

// ─── Extract references from index.html ─────────────────────────────────────

function extractHtmlReferences() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`ERROR: ${INDEX_HTML} not found. Run 'npm run build' first.`)
    process.exit(1)
  }

  const html = fs.readFileSync(INDEX_HTML, 'utf-8')
  const references = []

  // <script src="...">
  for (const [, src] of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    references.push({ src, type: 'script' })
  }

  // <link href="..." rel="modulepreload">
  for (const [, href] of html.matchAll(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']modulepreload["']/gi
  )) {
    references.push({ src: href, type: 'modulepreload' })
  }

  // <link href="..." rel="stylesheet">
  for (const [, href] of html.matchAll(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi
  )) {
    references.push({ src: href, type: 'stylesheet' })
  }

  // <link href="..." rel="preload">
  for (const [, href] of html.matchAll(
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']preload["']/gi
  )) {
    references.push({ src: href, type: 'preload' })
  }

  return references
}

// ─── Extract imports from a JS file ─────────────────────────────────────────

/**
 * Extracts all local asset references from a JS file.
 *
 * Handles:
 *   - import ... from "./chunk.js"  (static import)
 *   - import "./chunk.js"           (side-effect import)
 *   - import("./chunk.js")          (dynamic import)
 *   - new URL("./worker.js", ...)   (worker constructor)
 *
 * Returns an array of relative paths.
 */
function extractJsReferences(filePath) {
  const fullPath = path.join(DIST_DIR, filePath)
  if (!fs.existsSync(fullPath)) return []
  const content = fs.readFileSync(fullPath, 'utf-8')
  const references = []

  // Combined regex that matches all forms of JS module references.
  // We use a character class [^"'` ] that captures path-like strings.
  // Patterns matched:
  //   import("...")  or  import('...')
  //   from"..."  or  from'...'  (static imports)
  //   import"..."  or  import'...'  (side-effect imports)
  //   new URL("...",  (worker references)

  // Dynamic imports: import("./chunk.js")
  const dynamicImportRe = /import\s*\(\s*["']([^"']+\.(?:js|css))["']\s*\)/g
  let match
  while ((match = dynamicImportRe.exec(content)) !== null) {
    if (match[1].startsWith('.') || match[1].startsWith('/')) {
      references.push(match[1])
    }
  }

  // Static imports: from "./chunk.js" or import "./chunk.js"
  // "from" form: from"./chunk.js"
  const staticImportRe = /(?:from|import)\s*["']([^"']+\.(?:js|css|json))["']/g
  while ((match = staticImportRe.exec(content)) !== null) {
    if (match[1].startsWith('.') || match[1].startsWith('/')) {
      references.push(match[1])
    }
  }

  // Worker constructors: new URL("./worker.js", import.meta.url)
  // or: new Worker(new URL("./worker.js", import.meta.url))
  const workerRe = /new\s+(?:Worker|URL)\s*\(\s*(?:new\s+URL\s*\()?\s*["']([^"']+\.(?:worker\.)?js)["']/g
  while ((match = workerRe.exec(content)) !== null) {
    if (match[1].startsWith('.') || match[1].startsWith('/')) {
      references.push(match[1])
    }
  }

  return references
}

// ─── Parse manifest.json ────────────────────────────────────────────────────

function parseManifest() {
  if (!fs.existsSync(MANIFEST_JSON)) {
    console.warn('[verify-dist] No manifest.json found — skipping manifest-based verification')
    return null
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_JSON, 'utf-8'))
    return manifest
  } catch (err) {
    console.warn('[verify-dist] Failed to parse manifest.json:', err.message)
    return null
  }
}

/**
 * Extract all referenced asset files from the Vite manifest.
 * The manifest maps entry names to their chunk info, including:
 *   - file: the chunk's output file
 *   - imports: static imports
 *   - dynamicImports: lazy-loaded chunks
 *   - css: associated CSS files
 *   - assets: other assets
 */
function extractManifestReferences(manifest) {
  const references = []

  for (const [, chunk] of Object.entries(manifest)) {
    // Static imports
    if (chunk.imports) {
      for (const imp of chunk.imports) {
        const resolved = manifest[imp]?.file
        if (resolved) references.push({ src: resolved, type: 'manifest-static-import' })
      }
    }
    // Dynamic imports
    if (chunk.dynamicImports) {
      for (const imp of chunk.dynamicImports) {
        const resolved = manifest[imp]?.file
        if (resolved) references.push({ src: resolved, type: 'manifest-dynamic-import' })
      }
    }
    // CSS files
    if (chunk.css) {
      for (const css of chunk.css) {
        references.push({ src: css, type: 'manifest-css' })
      }
    }
    // Other assets
    if (chunk.assets) {
      for (const asset of chunk.assets) {
        references.push({ src: asset, type: 'manifest-asset' })
      }
    }
  }

  return references
}

// ─── Recursive dependency graph verification ────────────────────────────────

function verifyRecursive(allJsFiles) {
  const missing = []
  const checked = new Set()
  const queue = [...allJsFiles] // Start with all JS files

  // Breadth-first traversal of the import graph
  while (queue.length > 0) {
    const currentFile = queue.shift()

    if (checked.has(currentFile)) continue
    checked.add(currentFile)

    // Verify that the current file exists on disk
    if (!fileExists(currentFile)) {
      missing.push({ src: currentFile, type: 'js-chunk' })
      continue
    }

    // Extract all references from this file
    const baseDir = path.dirname(currentFile)
    const refs = extractJsReferences(currentFile)

    for (const importPath of refs) {
      const normalized = normalizeAssetPath(importPath, baseDir)

      // Verify the referenced file exists
      if (!fileExists(normalized)) {
        if (!missing.some(m => m.src === normalized)) {
          missing.push({
            src: normalized,
            type: 'js-import',
            from: currentFile,
          })
        }
      } else if (!checked.has(normalized) && normalized.endsWith('.js')) {
        // Queue JS files for recursive checking
        queue.push(normalized)
      }
    }
  }

  return { missing, checked }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('[verify-dist] Checking asset integrity...\n')

  let missingCount = 0
  const checked = new Set()

  // 1. Check HTML references
  const htmlRefs = extractHtmlReferences()
  console.log(`[verify-dist] Found ${htmlRefs.length} references in index.html`)

  for (const ref of htmlRefs) {
    const normalized = normalizeAssetPath(ref.src)
    if (checked.has(normalized)) continue
    checked.add(normalized)

    if (!fileExists(normalized)) {
      console.error(`  MISSING [${ref.type}]: ${ref.src} → ${normalized}`)
      missingCount++
    }
  }

  // 2. Manifest-based verification (if available)
  const manifest = parseManifest()
  if (manifest) {
    const manifestRefs = extractManifestReferences(manifest)
    console.log(`[verify-dist] Found ${manifestRefs.length} references in manifest.json`)

    for (const ref of manifestRefs) {
      const normalized = normalizeAssetPath(ref.src)
      if (checked.has(normalized)) continue
      checked.add(normalized)

      if (!fileExists(normalized)) {
        console.error(`  MISSING [${ref.type}]: ${ref.src} → ${normalized}`)
        missingCount++
      }
    }
  }

  // 3. Recursive dependency graph verification — scan ALL JS files
  const allJsFiles = findAllJsFiles()
  console.log(`[verify-dist] Scanning ${allJsFiles.length} JS files for recursive dependencies...`)

  const { missing: recMissing, checked: recChecked } = verifyRecursive(allJsFiles)

  for (const m of recMissing) {
    const fromInfo = m.from ? ` (referenced from ${m.from})` : ''
    console.error(`  MISSING [${m.type}]: ${m.src}${fromInfo}`)
    missingCount++
  }

  // Merge checked sets
  for (const c of recChecked) {
    checked.add(c)
  }

  // 4. Also verify CSS and other static files referenced by all JS
  const allDistFiles = new Set(findAllDistFiles())
  console.log(`[verify-dist] Total dist assets: ${allDistFiles.size}`)

  // 5. Verify non-JS references from all scanned JS files
  for (const jsFile of allJsFiles) {
    const refs = extractJsReferences(jsFile)
    for (const importPath of refs) {
      const baseDir = path.dirname(jsFile)
      const normalized = normalizeAssetPath(importPath, baseDir)
      if (checked.has(normalized)) continue
      checked.add(normalized)

      if (!fileExists(normalized)) {
        console.error(`  MISSING [js-ref]: ${importPath} → ${normalized} (from ${jsFile})`)
        missingCount++
      }
    }
  }

  // 6. Summary
  console.log(`\n[verify-dist] Checked ${checked.size} unique asset references`)
  console.log(`[verify-dist] Total JS chunks scanned: ${allJsFiles.length}`)

  if (missingCount > 0) {
    console.error(`\n[verify-dist] FAILED: ${missingCount} missing asset(s)`)
    process.exit(1)
  }

  console.log('[verify-dist] PASSED: All referenced assets exist')
  process.exit(0)
}

main()
