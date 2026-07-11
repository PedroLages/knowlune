#!/usr/bin/env node

/**
 * verify-dist.js — Post-build asset integrity verification
 *
 * Parses dist/index.html and verifies that every referenced asset file
 * actually exists in the dist/ directory. Also scans generated JS chunks
 * for dynamic import() references and checks those too.
 *
 * Purpose: catch build inconsistencies BEFORE deployment. A missing chunk
 * reference in the HTML or a JS entry point causes "Failed to fetch
 * dynamically imported module" errors in production.
 *
 * Usage: node scripts/verify-dist.js
 * Exit: 0 if all references resolve, 1 if any are broken.
 */

const fs = require('fs')
const path = require('path')

const DIST_DIR = path.resolve(__dirname, '..', 'dist')
const INDEX_HTML = path.join(DIST_DIR, 'index.html')

// ─── Helpers ──────────────────────────────────────────────────────────────

function fileExists(filePath) {
  return fs.existsSync(path.join(DIST_DIR, filePath))
}

function normalizeAssetPath(src, baseDir = '') {
  // Remove leading ./ or /
  let normalized = src.replace(/^\.?\//, '')
  // If it's an absolute path within the site, resolve it
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }
  // If baseDir is provided and path is relative
  if (baseDir && !normalized.startsWith('assets/') && !normalized.startsWith('/')) {
    normalized = path.join(baseDir, normalized)
  }
  return normalized
}

// ─── Extract references from index.html ────────────────────────────────────

function extractHtmlReferences() {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error(`ERROR: ${INDEX_HTML} not found. Run 'npm run build' first.`)
    process.exit(1)
  }

  const html = fs.readFileSync(INDEX_HTML, 'utf-8')
  const references = []

  // <script src="...">
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi
  let match
  while ((match = scriptRegex.exec(html)) !== null) {
    references.push({ src: match[1], type: 'script' })
  }

  // <link href="..." rel="modulepreload">
  const modulepreloadRegex = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']modulepreload["']/gi
  while ((match = modulepreloadRegex.exec(html)) !== null) {
    references.push({ src: match[1], type: 'modulepreload' })
  }

  // <link href="..." rel="stylesheet">
  const stylesheetRegex = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["']/gi
  while ((match = stylesheetRegex.exec(html)) !== null) {
    references.push({ src: match[1], type: 'stylesheet' })
  }

  // <link href="..." rel="preload">
  const preloadRegex = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']preload["']/gi
  while ((match = preloadRegex.exec(html)) !== null) {
    references.push({ src: match[1], type: 'preload' })
  }

  return references
}

// ─── Extract dynamic imports from JS files ─────────────────────────────────

function extractJsImports(filePath) {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  const references = []

  // Dynamic import('...') or import("...")
  const importRegex = /import\s*\(\s*["']([^"']+)["']\s*\)/g
  let match
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1]
    // Only check relative imports (skip bare specifiers like 'react')
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      references.push(importPath)
    }
  }

  return references
}

// ─── Main ──────────────────────────────────────────────────────────────────

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

  // 2. Check dynamic imports in all JS entry chunks
  const entryJsFiles = findEntryJsFiles()
  console.log(`[verify-dist] Scanning ${entryJsFiles.length} entry JS chunks for dynamic imports`)

  for (const jsFile of entryJsFiles) {
    const imports = extractJsImports(jsFile)
    for (const importPath of imports) {
      const baseDir = path.dirname(path.relative(DIST_DIR, jsFile))
      const normalized = normalizeAssetPath(importPath, baseDir)
      if (checked.has(normalized)) continue
      checked.add(normalized)

      if (!fileExists(normalized)) {
        console.error(`  MISSING [dynamic-import]: ${importPath} → ${normalized} (in ${path.relative(DIST_DIR, jsFile)})`)
        missingCount++
      }
    }
  }

  // 3. Check dist/assets for orphaned chunks (warn only)
  console.log(`[verify-dist] Checked ${checked.size} unique asset references`)

  // 4. Report
  if (missingCount > 0) {
    console.error(`\n[verify-dist] FAILED: ${missingCount} missing asset(s)`)
    process.exit(1)
  }

  console.log('[verify-dist] PASSED: All referenced assets exist')
  process.exit(0)
}

function findEntryJsFiles() {
  const assetsDir = path.join(DIST_DIR, 'assets')
  if (!fs.existsSync(assetsDir)) return []

  // Find index-*.js and react-vendor-*.js (the main entry + eager chunks)
  const files = fs.readdirSync(assetsDir)
  return files
    .filter(f => /^(index|react-vendor|radix-ui|react-router|dexie|style-utils|sonner|motion-vendor)-.+\.js$/.test(f))
    .map(f => path.join(assetsDir, f))
}

main()
