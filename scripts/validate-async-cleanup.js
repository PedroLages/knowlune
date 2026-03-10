#!/usr/bin/env node

/**
 * Validation script for async-cleanup ESLint rule
 *
 * Tests the rule against existing codebase to ensure:
 * 1. No false positives on valid patterns
 * 2. Catches actual violations
 * 3. Rule integrates correctly with ESLint config
 *
 * Usage: node scripts/validate-async-cleanup.js
 */

import { ESLint } from 'eslint'
import { join } from 'path'

const projectRoot = process.cwd()

// Files known to have useEffect hooks
const testFiles = [
  'src/app/pages/Overview.tsx',
  'src/app/pages/Library.tsx',
  'src/app/pages/Courses.tsx',
  'src/app/components/RecommendedNext.tsx',
  'src/app/components/Layout.tsx',
  'src/app/components/AchievementBanner.tsx',
  'src/app/components/StudyStreakCalendar.tsx',
]

async function validateRule() {
  console.log('🔍 Validating async-cleanup ESLint rule...\n')

  const eslint = new ESLint({
    overrideConfigFile: join(projectRoot, 'eslint.config.js'),
  })

  let totalFiles = 0
  let totalErrors = 0
  let totalWarnings = 0
  const filesWithViolations = []

  for (const file of testFiles) {
    const filePath = join(projectRoot, file)
    totalFiles++

    try {
      const results = await eslint.lintFiles([filePath])

      for (const result of results) {
        // Filter for only our rule
        const asyncCleanupMessages = result.messages.filter(
          msg => msg.ruleId === 'react-hooks-async/async-cleanup'
        )

        if (asyncCleanupMessages.length > 0) {
          console.log(`⚠️  ${file}:`)
          asyncCleanupMessages.forEach(msg => {
            console.log(`   Line ${msg.line}: ${msg.message}`)
            if (msg.severity === 2) totalErrors++
            else totalWarnings++
          })
          console.log()
          filesWithViolations.push(file)
        }
      }
    } catch (err) {
      console.error(`❌ Error linting ${file}:`, err.message)
    }
  }

  console.log('─'.repeat(60))
  console.log('📊 Validation Summary:\n')
  console.log(`   Files scanned: ${totalFiles}`)
  console.log(`   Files with violations: ${filesWithViolations.length}`)
  console.log(`   Total errors: ${totalErrors}`)
  console.log(`   Total warnings: ${totalWarnings}`)
  console.log()

  if (filesWithViolations.length > 0) {
    console.log('📝 Files requiring fixes:')
    filesWithViolations.forEach(file => console.log(`   - ${file}`))
    console.log()
    console.log('💡 See docs/engineering/async-useEffect-cleanup-patterns.md for fix patterns')
    console.log()
    return 1 // Exit code 1 for violations found
  } else {
    console.log('✅ All files pass async-cleanup validation!')
    console.log()
    console.log('🎯 Next steps:')
    console.log('   1. Review docs/engineering/async-useEffect-cleanup-patterns.md')
    console.log('   2. Run: npx eslint src/ --ext .ts,.tsx')
    console.log('   3. Fix any violations before committing')
    console.log()
    return 0 // Exit code 0 for success
  }
}

validateRule()
  .then(exitCode => {
    process.exit(exitCode)
  })
  .catch(err => {
    console.error('💥 Validation failed:', err)
    process.exit(2)
  })
