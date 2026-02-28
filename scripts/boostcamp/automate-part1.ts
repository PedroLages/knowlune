/**
 * Boostcamp Program Creator Automation — MHRP Part 1
 *
 * Automates filling in the "MHRP Part 1 — Foundation & Hypertrophy" program
 * in Boostcamp's web Program Creator using Playwright.
 *
 * Usage:
 *   npx tsx scripts/boostcamp/automate-part1.ts
 *
 * Prerequisites:
 *   - The draft program must already exist in your Boostcamp account
 *   - You'll log in manually when the browser opens
 */

import { chromium, type Page } from 'playwright'
import { mhrpPart1, type Week, type Day, type Exercise } from './part1-data.js'

// ─── Configuration ───────────────────────────────────────

const CONFIG = {
  /** Boostcamp URLs (discovered via Chrome DevTools session) */
  baseUrl: 'https://www.boostcamp.app',
  customProgramUrl: 'https://www.boostcamp.app/custom-program',

  /** Draft program name to look for */
  draftProgramName: 'MHRP Part 1',

  /** Slow down actions for UI stability (ms) */
  slowMo: 50,

  /** Timeouts */
  loginTimeout: 120_000, // 2 min to log in
  actionTimeout: 10_000, // 10s per action
  exerciseSearchTimeout: 5_000, // 5s for search dropdown

  /** Retry config */
  maxRetries: 2,

  /** Screenshot directory */
  screenshotDir: 'scripts/boostcamp/screenshots',

  /** Start from this week (1-indexed, useful for resuming) */
  startFromWeek: 1,

  /** Only process these weeks (empty = all) */
  onlyWeeks: [] as number[],

  /** Start from this day within the start week (1-indexed, useful for resuming) */
  startFromDay: 1,

  /** Skip first N exercises in the start day (useful for resuming mid-day) */
  skipExercises: 0,

  /** Auto-save after each week */
  autoSave: true,
}

// ─── Logging ─────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toLocaleTimeString('en-GB')
  console.log(`[${ts}] ${msg}`)
}

function logExercise(week: number, dayName: string, exNum: number, total: number, exName: string, status: string) {
  log(`  W${week} | ${dayName} | ${exNum}/${total} ${exName} — ${status}`)
}

// ─── Helpers ─────────────────────────────────────────────

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function screenshot(page: Page, name: string) {
  try {
    await page.screenshot({ path: `${CONFIG.screenshotDir}/${name}.png`, fullPage: false })
  } catch {
    log(`  ⚠ Could not save screenshot: ${name}`)
  }
}

async function dismissPopups(page: Page) {
  try {
    const removed = await page.evaluate(() => {
      let count = 0
      // Only target the Ant Design modal wrapper for PRO/Subscribe dialogs
      document.querySelectorAll('.ant-modal-wrap, .ant-modal-root').forEach((m) => {
        if (m.innerHTML.includes('PRO') || m.innerHTML.includes('Subscribe') || m.innerHTML.includes('Upgrade')) {
          ;(m as HTMLElement).remove()
          count++
        }
      })
      // Cookie consent widget only
      const cb = document.getElementById('CookiebotWidget')
      if (cb) { cb.style.display = 'none'; count++ }
      return count
    })
    if (removed > 0) log(`  Dismissed ${removed} popup element(s)`)
  } catch {
    // Ignore
  }
}

// ─── Navigation ──────────────────────────────────────────

async function waitForLogin(page: Page) {
  log('Opening Boostcamp — please log in manually')
  log('  → You have 2 minutes to sign in')
  log('  → The script will detect your login automatically')

  // Navigate to Boostcamp
  await page.goto(CONFIG.customProgramUrl)
  await wait(2000)

  // Dismiss cookie consent if present
  try {
    const allowBtn = page.locator('text=Allow all').first()
    await allowBtn.waitFor({ timeout: 3000 })
    await allowBtn.click()
    log('  Dismissed cookie consent')
    await wait(1000)
  } catch {
    // No cookie banner
  }

  // Poll: wait for the user to log in
  // Key signals: nav shows user avatar/name instead of "Log in" button, or draft programs appear
  const startTime = Date.now()
  while (Date.now() - startTime < CONFIG.loginTimeout) {
    const isLoggedIn = await page.evaluate(() => {
      const body = document.body.innerText
      // Check if "Log in" appears in the navigation area (top of page)
      const nav = document.querySelector('nav, header')
      const hasLoginButton = nav?.textContent?.includes('Log in') ?? body.includes('Log in')

      // Authenticated signals: user's program cards, nav without "Log in"
      const hasDraft = body.includes('Draft')
      const hasUserName = body.includes('Pedro') // user's name in nav
      const hasLogOut = body.includes('Log Out')

      return (hasDraft || hasUserName || hasLogOut) && !hasLoginButton
    }).catch(() => false)

    if (isLoggedIn) {
      log('Login detected!')
      // Make sure we're on the custom-program page
      if (!page.url().includes('/custom-program')) {
        await page.goto(CONFIG.customProgramUrl)
        await wait(3000)
      }
      return
    }

    // Check if user might have logged in and got redirected
    const url = page.url()
    if (url.includes('/custom-program') || url.includes('/home') || url === CONFIG.baseUrl + '/') {
      // Check again for auth indicators
      const hasDraft = await page.evaluate(() => document.body.innerText.includes('Draft')).catch(() => false)
      if (hasDraft) {
        log('Login detected — drafts visible!')
        return
      }
    }

    await wait(2000)
  }

  // Final attempt: navigate to custom-program and check
  log('Login timeout approaching — checking one more time...')
  await page.goto(CONFIG.customProgramUrl)
  await wait(5000)
}

async function navigateToBuildProgram(page: Page) {
  log(`Looking for draft program: "${CONFIG.draftProgramName}"`)
  await dismissPopups(page)
  await screenshot(page, '00-my-programs')

  // Click the program card — find the div with onclick that contains our program name
  // The card uses a CSS module class like main--XXXX, so match by the text content
  const programCard = page.locator(`div:has-text("${CONFIG.draftProgramName}")`).locator('xpath=ancestor-or-self::div[@onclick or contains(@class, "main--")]').first()
  try {
    await programCard.waitFor({ timeout: 5000 })
    await programCard.click()
    log('  Clicked program card')
  } catch {
    // Fallback: find by evaluating DOM for onclick handler containing program text
    log('  Locator failed, trying JS click...')
    await page.evaluate((name) => {
      const divs = Array.from(document.querySelectorAll('div'))
      const card = divs.find(d => d.onclick && d.innerText?.includes(name))
        || divs.find(d => d.innerText?.includes(name) && d.className?.includes('main--'))
      if (card) card.click()
      else throw new Error('Program card not found')
    }, CONFIG.draftProgramName)
  }
  await wait(2000)

  // Handle "Need to Make Changes?" confirmation dialog
  try {
    const continueBtn = page.locator('button.ant-btn-primary:not(.ant-btn-background-ghost)')
    await continueBtn.waitFor({ timeout: 5000 })
    const btnText = await continueBtn.textContent()
    if (btnText?.includes('Continue')) {
      await continueBtn.click()
      log('  Dismissed "Need to Make Changes" dialog')
      await wait(2000)
    }
  } catch {
    log('  No confirmation dialog (already editable)')
  }

  // We're now on Program Info page — click "Next" to go to Build Program
  try {
    const nextBtn = page.locator('button.ant-btn-primary.ant-btn-round')
    await nextBtn.waitFor({ timeout: 5000 })
    await nextBtn.click()
    log('  Clicked "Next" — navigating to Build Program')
    await wait(3000)
  } catch {
    log('  No "Next" button — may already be on Build Program')
  }

  // Verify we're on the Build Program view (should have week headings)
  await page.waitForSelector('h4:has-text("Week 1")', { timeout: CONFIG.actionTimeout })
  log('  Build Program view loaded!')
  await dismissPopups(page)
  await screenshot(page, '01-build-program')
}

// ─── Exercise Entry ──────────────────────────────────────

/**
 * Get the current "Add Exercise" button index for a given week/day.
 * Boostcamp renders all weeks horizontally, each with day sections.
 * The button indices change as days/exercises are added.
 */
async function getAddExerciseButtonIndex(page: Page, weekNum: number, dayIdx: number): Promise<number> {
  return await page.evaluate(
    ({ weekNum, dayIdx }) => {
      const addBtns = Array.from(document.querySelectorAll('button')).filter(
        (b) => b.textContent?.trim() === 'Add Exercise',
      )

      // Walk up from each button to find its week/day context
      for (let i = 0; i < addBtns.length; i++) {
        let el: HTMLElement | null = addBtns[i]
        for (let j = 0; j < 15; j++) {
          el = el?.parentElement ?? null
          if (!el) break
          const text = el.innerText || ''
          const weekMatch = text.match(/^Week (\d+)/)
          const dayMatch = text.match(/Day (\d+)/)
          if (weekMatch && dayMatch) {
            const w = parseInt(weekMatch[1])
            const d = parseInt(dayMatch[1])
            if (w === weekNum && d === dayIdx + 1) return i
          }
        }
      }
      return -1
    },
    { weekNum, dayIdx },
  )
}

async function addExerciseToDay(page: Page, exercise: Exercise, weekNum: number, dayIdx: number): Promise<boolean> {
  try {
    // Find the correct "Add Exercise" button
    const btnIdx = await getAddExerciseButtonIndex(page, weekNum, dayIdx)

    if (btnIdx === -1) {
      // Fallback: use sequential index
      log(`    ⚠ Could not find button by context, using fallback index`)
      const allBtns = page.locator('button:has-text("Add Exercise")')
      const count = await allBtns.count()
      log(`    Total "Add Exercise" buttons: ${count}`)
      return false
    }

    // Click the Add Exercise button
    const addBtn = page.locator('button:has-text("Add Exercise")').nth(btnIdx)
    await addBtn.scrollIntoViewIfNeeded()
    await wait(300)
    await addBtn.click()
    await wait(1000)

    // Type in the exercise search (uses Playwright's real keystrokes via CDP)
    const searchInput = page.locator('.ant-select-selection-search-input').last()
    await searchInput.waitFor({ timeout: CONFIG.exerciseSearchTimeout })
    await searchInput.click()
    await wait(200)
    await searchInput.type(exercise.search, { delay: 60 })
    await wait(2000) // Wait for search results to populate

    // Select the matching exercise from dropdown
    let selected = false

    if (exercise.expected) {
      // Try exact match first
      const exactOption = page.locator(`.ant-select-item-option-content`).filter({ hasText: exercise.expected })
      try {
        await exactOption.first().waitFor({ timeout: 3000 })
        await exactOption.first().click()
        selected = true
      } catch {
        // Fall through
      }
    }

    if (!selected) {
      // Try partial match (not "Create New Exercise")
      const options = page.locator('.ant-select-item-option-content')
      const count = await options.count()
      const searchWord = exercise.search.toLowerCase().split(' ')[0]
      for (let i = 0; i < count; i++) {
        const text = (await options.nth(i).textContent()) || ''
        if (!text.includes('Create New') && text.toLowerCase().includes(searchWord)) {
          await options.nth(i).click()
          selected = true
          break
        }
      }
    }

    if (!selected) {
      // Last resort: Create New Exercise
      const createNew = page.locator('.ant-select-item-option-content:has-text("Create New Exercise")')
      try {
        await createNew.click()
        log(`    ⚠ Created new: ${exercise.search}`)
        selected = true
      } catch {
        log(`    ✗ No match and no Create New option`)
        // Cancel and move on
        const cancelBtn = page.locator('button:has-text("Cancel")').first()
        try {
          await cancelBtn.click()
        } catch {}
        return false
      }
    }

    await wait(800)

    // Set reps value using the Ant Design input
    const repsInputs = page.locator('.ant-input.ant-input-sm[class*="input--"]')
    const inputCount = await repsInputs.count()
    if (inputCount >= 2) {
      // Second-to-last = reps, last = RPE
      const repsInput = repsInputs.nth(inputCount - 2)
      await repsInput.click()
      await repsInput.fill(exercise.reps)

      if (exercise.rpe) {
        const rpeInput = repsInputs.nth(inputCount - 1)
        await rpeInput.click()
        await rpeInput.fill(exercise.rpe)
      }
    } else if (inputCount >= 1) {
      // Only reps input visible
      const repsInput = repsInputs.nth(inputCount - 1)
      await repsInput.click()
      await repsInput.fill(exercise.reps)
    }
    await wait(300)

    // Add additional sets (Set 1 is already there, "Add Set" duplicates it)
    for (let s = 1; s < exercise.sets; s++) {
      const addSetBtn = page.locator('button:has-text("Add Set")').first()
      try {
        await addSetBtn.click()
        await wait(400)
      } catch {
        log(`    ⚠ Could not add set ${s + 1}`)
      }
    }

    // Click OK to confirm
    await wait(300)
    const okBtn = page.locator('button:has-text("OK")').first()
    try {
      await okBtn.click()
      await wait(800)
    } catch {
      log(`    ⚠ Could not click OK`)
    }

    return true
  } catch (err) {
    log(`    ✗ Error: ${(err as Error).message}`)
    // Try to cancel any open form
    try {
      await page.locator('button:has-text("Cancel")').first().click()
    } catch {}
    return false
  }
}

// ─── Day & Week Processing ───────────────────────────────

async function countExistingExercises(page: Page, weekNum: number, dayIdx: number): Promise<number> {
  return await page.evaluate(
    ({ weekNum, dayIdx }) => {
      // Find the "Add Exercise" button for this week/day and count exercises in its section
      const addBtns = Array.from(document.querySelectorAll('button')).filter(
        (b) => b.textContent?.trim() === 'Add Exercise',
      )

      for (const btn of addBtns) {
        let el: HTMLElement | null = btn
        for (let j = 0; j < 15; j++) {
          el = el?.parentElement ?? null
          if (!el) break
          const text = el.innerText || ''
          const weekMatch = text.match(/^Week (\d+)/)
          const dayMatch = text.match(/Day (\d+)/)
          if (weekMatch && dayMatch) {
            const w = parseInt(weekMatch[1])
            const d = parseInt(dayMatch[1])
            if (w === weekNum && d === dayIdx + 1) {
              // Count exercise rows in this day section
              const rows = el.querySelectorAll('[class*="exerciseRow"], [class*="exercise_row"]')
              if (rows.length > 0) return rows.length
              // Fallback: count numbered rows
              const nums = el.querySelectorAll('[class*="index"], [class*="num"]')
              return nums.length
            }
          }
        }
      }
      return 0
    },
    { weekNum, dayIdx },
  )
}

async function doesDayExist(page: Page, weekNum: number, dayIdx: number): Promise<boolean> {
  return await page.evaluate(
    ({ weekNum, dayIdx }) => {
      const text = document.body.innerText
      // Check if "Day N" header exists within the week context
      // Simple heuristic: search for the pattern in the page text
      const dayNum = dayIdx + 1
      const pattern = new RegExp(`Week ${weekNum}[\\s\\S]*?Day ${dayNum}`)
      return pattern.test(text)
    },
    { weekNum, dayIdx },
  )
}

async function addDay(page: Page, weekNum: number): Promise<void> {
  // Find the "+ Add Day" button for this specific week
  const addDayIdx = await page.evaluate((weekNum) => {
    const addDayBtns = Array.from(document.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === '+ Add Day' || b.textContent?.trim() === 'Add Day',
    )
    for (let i = 0; i < addDayBtns.length; i++) {
      let el: HTMLElement | null = addDayBtns[i]
      for (let j = 0; j < 15; j++) {
        el = el?.parentElement ?? null
        if (!el) break
        const weekMatch = el.innerText?.match(/^Week (\d+)/)
        if (weekMatch && parseInt(weekMatch[1]) === weekNum) return i
      }
    }
    return -1
  }, weekNum)

  if (addDayIdx >= 0) {
    const addDayBtn = page
      .locator('button:has-text("Add Day")')
      .nth(addDayIdx)
    await addDayBtn.scrollIntoViewIfNeeded()
    await addDayBtn.click()
    await wait(1000)
    log(`  Added new day to Week ${weekNum}`)
  } else {
    log(`  ⚠ Could not find "Add Day" button for Week ${weekNum}`)
  }
}

async function processDayExercises(page: Page, week: Week, dayIdx: number, exercises: Exercise[]) {
  const day = week.days[dayIdx]
  const weekNum = week.weekNumber

  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const exercise = exercises[exIdx]
    logExercise(weekNum, day.name, exIdx + 1, exercises.length, exercise.name, 'adding...')

    let success = false
    for (let retry = 0; retry <= CONFIG.maxRetries; retry++) {
      success = await addExerciseToDay(page, exercise, weekNum, dayIdx)
      if (success) break
      if (retry < CONFIG.maxRetries) {
        log(`    Retrying (${retry + 1}/${CONFIG.maxRetries})...`)
        await wait(1000)
      }
    }

    if (success) {
      logExercise(weekNum, day.name, exIdx + 1, exercises.length, exercise.name, '✓')
    } else {
      logExercise(weekNum, day.name, exIdx + 1, exercises.length, exercise.name, 'FAILED ✗')
    }
  }
}

async function processWeek(page: Page, week: Week) {
  const weekNum = week.weekNumber
  log(`\n${'═'.repeat(60)}`)
  log(`Week ${weekNum}: ${week.phase}`)
  log(`${'═'.repeat(60)}`)

  for (let dayIdx = 0; dayIdx < week.days.length; dayIdx++) {
    const day = week.days[dayIdx]
    const dayNum = dayIdx + 1

    // Check if this day should be skipped (resume support)
    if (weekNum === CONFIG.startFromWeek && dayNum < CONFIG.startFromDay) {
      log(`  Day ${dayNum} (${day.name}) — skipping (before startFromDay)`)
      continue
    }

    log(`  Day ${dayNum}: ${day.name}`)

    // Check if the day exists already
    const dayExists = await doesDayExist(page, weekNum, dayIdx)

    if (!dayExists && dayIdx > 0) {
      // Need to add this day
      await addDay(page, weekNum)
    }

    // Determine which exercises to add
    let exercisesToAdd = day.exercises

    // If resuming mid-day, skip already-entered exercises
    if (weekNum === CONFIG.startFromWeek && dayNum === CONFIG.startFromDay && CONFIG.skipExercises > 0) {
      exercisesToAdd = day.exercises.slice(CONFIG.skipExercises)
      log(`    Skipping first ${CONFIG.skipExercises} exercises (resume)`)
    } else if (dayExists) {
      // Day exists — check how many exercises are already entered
      const existingCount = await countExistingExercises(page, weekNum, dayIdx)
      if (existingCount >= day.exercises.length) {
        log(`    Day already complete (${existingCount} exercises) — skipping`)
        continue
      } else if (existingCount > 0) {
        exercisesToAdd = day.exercises.slice(existingCount)
        log(`    ${existingCount} exercises already entered — adding remaining ${exercisesToAdd.length}`)
      }
    }

    if (exercisesToAdd.length > 0) {
      await processDayExercises(page, week, dayIdx, exercisesToAdd)
    }
  }

  // Auto-save after each week
  if (CONFIG.autoSave) {
    try {
      const saveBtn = page.locator('button:has-text("Save"), a:has-text("Save")').first()
      await saveBtn.click()
      await wait(2000)
      log(`  Week ${weekNum} saved ✓`)
    } catch {
      log(`  ⚠ Could not auto-save after Week ${weekNum}`)
    }
  }

  await screenshot(page, `week-${weekNum}-done`)
  log(`Week ${weekNum} complete ✓`)
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  log('MHRP Part 1 — Boostcamp Automation')
  log(`Program: ${mhrpPart1.name}`)
  log(`Total weeks: ${mhrpPart1.totalWeeks}`)
  if (CONFIG.startFromWeek > 1 || CONFIG.startFromDay > 1 || CONFIG.skipExercises > 0) {
    log(`Resuming from: Week ${CONFIG.startFromWeek}, Day ${CONFIG.startFromDay}, Skip ${CONFIG.skipExercises} exercises`)
  }
  log('')

  // Create screenshot directory
  const { mkdirSync } = await import('fs')
  mkdirSync(CONFIG.screenshotDir, { recursive: true })

  // Launch headed browser
  log('Launching browser (headed mode)...')
  const browser = await chromium.launch({
    headless: false,
    slowMo: CONFIG.slowMo,
    args: ['--window-size=1400,900'],
  })

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(CONFIG.actionTimeout)

  try {
    // Step 1: Login
    await waitForLogin(page)
    await wait(2000)

    // Step 2: Navigate to Build Program
    await navigateToBuildProgram(page)

    // Step 3: Process each week
    const weeksToProcess = mhrpPart1.weeks.filter((w) => {
      if (CONFIG.onlyWeeks.length > 0) return CONFIG.onlyWeeks.includes(w.weekNumber)
      return w.weekNumber >= CONFIG.startFromWeek
    })

    log(`\nProcessing ${weeksToProcess.length} weeks...`)

    for (const week of weeksToProcess) {
      await processWeek(page, week)
    }

    // Step 4: Final save
    log('\n✓ All weeks processed!')
    try {
      const saveBtn = page.locator('button:has-text("Save")').first()
      await saveBtn.click()
      await wait(3000)
      log('Final save completed')
    } catch {
      log('Review the program in Boostcamp, then save manually.')
    }
    log('Press Ctrl+C to close the browser when done.')

    // Keep browser open for review
    await page.waitForTimeout(300_000)
  } catch (err) {
    log(`\n✗ Error: ${(err as Error).message}`)
    await screenshot(page, 'error-final')
    throw err
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('\nScript failed:', err)
  process.exit(1)
})
