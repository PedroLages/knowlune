#!/usr/bin/env node
/**
 * Test Anti-Pattern Validator
 * Detects non-deterministic patterns in E2E test files
 * Epic 10 Code Quality Initiative
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const TEST_DIR = 'tests/e2e'

const ANTI_PATTERNS = {
  dateNow: {
    regex: /Date\.now\(\)/g,
    exception: /page\.addInitScript.*Date\.now/s,
    severity: 'HIGH',
    message: 'Use FIXED_TIMESTAMP from tests/utils/test-time.ts instead',
  },
  newDate: {
    regex: /new Date\(\)/g,
    exception: /new Date\(FIXED_DATE\)|new Date\(getRelativeDate/,
    severity: 'HIGH',
    message: 'Use FIXED_DATE or getRelativeDate() from tests/utils/test-time.ts',
  },
  waitForTimeout: {
    regex: /waitForTimeout\(/g,
    exception: /\/\/ (Intentional|Necessary|Required)/i,
    severity: 'MEDIUM',
    message: 'Use expect().toBeVisible() or waitForFunction() instead',
  },
  manualIndexedDB: {
    regex: /indexedDB\.open\(/g,
    exception: /tests\/support\/helpers\/indexeddb-seed\.ts/,
    severity: 'MEDIUM',
    message: 'Use seedIndexedDBStore() from tests/support/helpers/indexeddb-seed.ts',
  },
  missingTestTimeImport: {
    detect: (content) => {
      const hasDateKeywords = /\b(timestamp|duration|delay)\b/i.test(content)
      const hasTestTimeImport = /from ['"].*test-time/.test(content)
      const hasDateUsage = /Date\.|new Date|\.now\(\)/.test(content)
      return hasDateKeywords && !hasTestTimeImport && !hasDateUsage
    },
    severity: 'LOW',
    message: 'File contains time-related logic but doesn\'t import test-time utilities. Consider importing FIXED_DATE for deterministic testing.',
  },
  testFileSize: {
    detect: (content) => {
      const lines = content.split('\n').length
      return lines >= 280 && lines < 400
    },
    severity: 'LOW',
    message: 'Test file approaching 300-line target ({{lines}} lines). Consider splitting for maintainability.',
  },
  todoComments: {
    regex: /\/\/\s*TODO:/gi,
    severity: 'LOW',
    message: 'TODO comment found. Complete before merging or create ticket.',
  },
  debugConsole: {
    regex: /console\.(log|debug|info)\(/g,
    severity: 'LOW',
    message: 'Debug console.log found. Remove before merging.',
  },
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function validateTestFile(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const findings = []
  const lines = content.split('\n').length

  for (const [name, config] of Object.entries(ANTI_PATTERNS)) {
    let isMatch = false
    let matchCount = 0

    // Handle detect() function patterns
    if (config.detect) {
      isMatch = config.detect(content)
      matchCount = 1
    }
    // Handle regex patterns
    else if (config.regex) {
      const matches = content.match(config.regex)
      if (matches && (!config.exception || !config.exception.test(content))) {
        isMatch = true
        matchCount = matches.length
      }
    }

    if (isMatch) {
      // Replace {{lines}} placeholder for testFileSize
      let message = config.message
      if (name === 'testFileSize') {
        message = message.replace('{{lines}}', lines)
      }

      findings.push({
        name,
        severity: config.severity,
        message,
        count: matchCount,
      })
    }
  }

  return findings
}

function getAllTestFiles(dir) {
  const files = []

  function walk(directory) {
    const items = readdirSync(directory)

    for (const item of items) {
      const fullPath = join(directory, item)
      const stat = statSync(fullPath)

      if (stat.isDirectory() && item !== 'regression') {
        walk(fullPath)
      } else if (item.endsWith('.spec.ts') || item.endsWith('.spec.tsx')) {
        files.push(fullPath)
      }
    }
  }

  walk(dir)
  return files
}

function main() {
  const args = process.argv.slice(2)
  const targetFiles = args.length > 0 ? args : getAllTestFiles(TEST_DIR)

  console.log(`${colors.blue}🔍 Validating E2E test patterns...${colors.reset}\n`)

  const results = new Map()
  let totalFiles = 0
  let filesWithAntiPatterns = 0
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0

  for (const file of targetFiles) {
    try {
      const findings = validateTestFile(file)
      totalFiles++

      if (findings.length > 0) {
        filesWithAntiPatterns++
        results.set(file, findings)

        for (const finding of findings) {
          if (finding.severity === 'HIGH') highCount++
          if (finding.severity === 'MEDIUM') mediumCount++
          if (finding.severity === 'LOW') lowCount++
        }
      }
    } catch (error) {
      // silent-catch-ok: error logged to console in CLI script
      console.error(`${colors.red}Error reading ${file}: ${error.message}${colors.reset}`)
    }
  }

  // Print findings
  if (results.size > 0) {
    for (const [file, findings] of results) {
      const relativePath = relative(process.cwd(), file)
      console.log(`${colors.yellow}⚠️  ${relativePath}:${colors.reset}`)

      for (const finding of findings) {
        const severityColor =
          finding.severity === 'HIGH' ? colors.red :
          finding.severity === 'MEDIUM' ? colors.yellow :
          colors.cyan
        const count = finding.count > 1 ? ` (${finding.count} occurrences)` : ''
        console.log(`   ${severityColor}[${finding.severity}]${colors.reset} ${finding.name}${count}`)
        console.log(`   ${colors.cyan}→ Fix:${colors.reset} ${finding.message}`)
      }

      console.log('')
    }

    console.log(`${colors.blue}─────────────────────────────────────────────────────────${colors.reset}`)
    console.log(`${colors.blue}📊 Validation Summary:${colors.reset}`)
    console.log(`   Files scanned: ${totalFiles}`)
    console.log(`   Files with anti-patterns: ${filesWithAntiPatterns}`)
    console.log(`   ${colors.red}HIGH${colors.reset} severity: ${highCount}`)
    console.log(`   ${colors.yellow}MEDIUM${colors.reset} severity: ${mediumCount}`)
    console.log(`   ${colors.cyan}LOW${colors.reset} severity: ${lowCount}`)
    console.log('')
    console.log(`${colors.yellow}💡 HIGH/MEDIUM must be fixed. LOW are suggestions.${colors.reset}`)

    // Exit 1 only for HIGH/MEDIUM, exit 0 for LOW-only
    const hasBlockingIssues = highCount > 0 || mediumCount > 0
    process.exit(hasBlockingIssues ? 1 : 0)
  } else {
    console.log(`${colors.green}✅ No test anti-patterns detected${colors.reset}`)
    console.log(`   Files scanned: ${totalFiles}`)
    process.exit(0)
  }
}

main()
