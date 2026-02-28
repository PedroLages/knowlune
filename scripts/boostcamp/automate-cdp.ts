/**
 * Boostcamp Automation via CDP — connects to existing Chrome session
 *
 * Attaches to an already-running Chrome (superpowers-chrome on port 9222)
 * and automates exercise entry. No login needed.
 *
 * CRITICAL: All button clicks use Playwright's native .click() (real CDP events).
 * JS dispatchEvent does NOT trigger React handlers on this site.
 *
 * Usage:  npx tsx scripts/boostcamp/automate-cdp.ts
 */

import { chromium, type Page } from 'playwright'
import { mhrpPart1, type Exercise } from './part1-data.js'

// ─── Configuration ───────────────────────────────────────

const CONFIG = {
  cdpUrl: 'http://127.0.0.1:9222',
  startFromWeek: 1,
  startFromDay: 1,
  skipExercises: 0,
  onlyWeeks: [1] as number[],   // Test with Week 1 only first
  searchDelay: 80,
  actionDelay: 1500,
  dropdownDelay: 2500,
  autoSave: false,               // Don't save during testing
}

// ─── Logging ─────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
  console.log(`[${ts}] ${msg}`)
}
function logError(msg: string) {
  console.log(`\n✗ Error: ${msg}\n`)
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Button click helpers (tag + native CDP click) ───────

/** Tag the "Add Exercise" button inside a specific day container, then native-click it */
async function clickAddExercise(page: Page, containerIdx: number): Promise<void> {
  await page.evaluate((idx) => {
    const days = document.querySelectorAll('[class*="main--Ijz7"]')
    const day = days[idx] as HTMLElement | undefined
    if (!day) return
    day.scrollIntoView({ block: 'center' })
    const btns = day.querySelectorAll('button')
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].textContent?.trim() === 'Add Exercise') {
        btns[i].id = '_ae'
        btns[i].scrollIntoView({ block: 'center' })
        return
      }
    }
  }, containerIdx)
  await page.click('#_ae', { timeout: 5000 })
  await page.evaluate(() => document.getElementById('_ae')?.removeAttribute('id'))
}

/** Tag the Nth "+ Add Day" button by week index, then native-click it */
async function clickAddDay(page: Page, weekIndex: number): Promise<void> {
  await page.evaluate((wi) => {
    const btns = document.querySelectorAll('button')
    let count = 0
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].textContent?.trim() === 'Add Day') {
        if (count === wi) {
          btns[i].id = '_ad'
          btns[i].scrollIntoView({ block: 'center' })
          return
        }
        count++
      }
    }
  }, weekIndex)
  await page.click('#_ad', { timeout: 5000 })
  await page.evaluate(() => document.getElementById('_ad')?.removeAttribute('id'))
}

/** Tag the last button matching `text`, then native-click it */
async function clickLastButtonByText(page: Page, text: string, tag: string): Promise<void> {
  await page.evaluate(({ t, tg }) => {
    const btns = document.querySelectorAll('button')
    let match: HTMLElement | null = null
    for (let i = 0; i < btns.length; i++) {
      if (btns[i].textContent?.trim() === t) match = btns[i] as HTMLElement
    }
    if (match) {
      match.id = tg
      match.scrollIntoView({ block: 'center' })
    }
  }, { t: text, tg: tag })
  await page.click(`#${tag}`, { timeout: 5000 })
  await page.evaluate((tg) => document.getElementById(tg)?.removeAttribute('id'), tag)
}

// ─── Day container mapping ───────────────────────────────

interface DayMap {
  weekNum: number
  dayNum: number
  containerIdx: number
  exerciseCount: number
}

async function buildDayMap(page: Page): Promise<DayMap[]> {
  return page.evaluate(() => {
    const days = document.querySelectorAll('[class*="main--Ijz7"]') as NodeListOf<HTMLElement>
    const result: { weekNum: number; dayNum: number; containerIdx: number; exerciseCount: number }[] = []
    let weekNum = 0

    for (let i = 0; i < days.length; i++) {
      const text = days[i].textContent || ''
      const dayMatch = text.match(/Day (\d)/)
      if (!dayMatch) continue

      const dayN = parseInt(dayMatch[1])
      if (dayN === 1) weekNum++

      // Count exercises by row containers (each exercise = one .row--Yrwr div)
      const exerciseRows = days[i].querySelectorAll('[class*="row--Yrwr"]')

      result.push({ weekNum, dayNum: dayN, containerIdx: i, exerciseCount: exerciseRows.length })
    }
    return result
  })
}

// ─── Exercise entry ──────────────────────────────────────

async function addExercise(page: Page, containerIdx: number, exercise: Exercise): Promise<void> {
  // 1. Click "Add Exercise" (real CDP click)
  await clickAddExercise(page, containerIdx)
  await sleep(CONFIG.actionDelay)

  // 2. Type search — target the exercise name search (not the Reps/RPE selects)
  //    The exercise search has .ant-select-show-search but NOT .ant-select-borderless
  const searchSel = '.ant-select-show-search:not(.ant-select-borderless) input'
  const searchInput = page.locator(searchSel)
  await searchInput.click({ timeout: 5000 })
  await sleep(300)
  await searchInput.type(exercise.search, { delay: CONFIG.searchDelay })
  await sleep(CONFIG.dropdownDelay)

  // 3. Select from dropdown (JS click works on dropdown items)
  const selected = await page.evaluate((search) => {
    const options = Array.from(document.querySelectorAll('.ant-select-item-option-content'))
    let match = options.find(o => (o as HTMLElement).innerText.trim() === search)
    if (!match) match = options.find(o => (o as HTMLElement).innerText.toLowerCase().includes(search.toLowerCase()))
    if (!match && options.length > 0) match = options[0]
    if (match) { (match as HTMLElement).click(); return (match as HTMLElement).innerText.trim() }
    // "Create New Exercise" is a separate button, not an option-content element
    const createBtn = Array.from(document.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Create New Exercise'
    )
    if (createBtn) { (createBtn as HTMLElement).click(); return 'CREATE_NEW' }
    return null
  }, exercise.search)

  if (!selected) throw new Error(`No match for: "${exercise.search}"`)
  if (selected === 'CREATE_NEW') log(`      ⚠ Creating new: ${exercise.search}`)
  await sleep(CONFIG.actionDelay)

  // 4. Set reps and RPE
  await page.evaluate(({ reps, rpe }) => {
    const inputs = document.querySelectorAll('.ant-input.ant-input-sm[class*="input--"]') as NodeListOf<HTMLInputElement>
    if (inputs.length < 2) return
    const repsInput = inputs[inputs.length - 2]
    const rpeInput = inputs[inputs.length - 1]
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    if (!setter) return
    setter.call(repsInput, reps)
    repsInput.dispatchEvent(new Event('input', { bubbles: true }))
    repsInput.dispatchEvent(new Event('change', { bubbles: true }))
    if (rpe) {
      setter.call(rpeInput, rpe)
      rpeInput.dispatchEvent(new Event('input', { bubbles: true }))
      rpeInput.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, { reps: exercise.reps, rpe: exercise.rpe || '' })
  await sleep(500)

  // 5. Add extra sets
  for (let s = 1; s < exercise.sets; s++) {
    await clickLastButtonByText(page, 'Add Set', '_as')
    await sleep(400)
  }

  // 6. Click OK
  await clickLastButtonByText(page, 'OK', '_ok')
  await sleep(CONFIG.actionDelay)
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  log('MHRP Part 1 — CDP Automation (v2)')
  log(`Connecting to Chrome on ${CONFIG.cdpUrl}...`)

  let browser
  try {
    browser = await chromium.connectOverCDP(CONFIG.cdpUrl)
  } catch (e: any) {
    logError(`Cannot connect: ${e.message}`)
    process.exit(1)
  }

  const pages = browser.contexts()[0]?.pages() || []
  const page = pages.find(p => p.url().includes('boostcamp.app'))
  if (!page) { logError('No Boostcamp tab found'); process.exit(1) }

  log(`Tab: ${page.url()}`)
  const ok = await page.evaluate(() => document.body.innerText.includes('Build Program'))
  if (!ok) { logError('Not on Build Program view'); process.exit(1) }
  log('Build Program view confirmed!')

  let dayMap = await buildDayMap(page)
  log(`Found ${dayMap.length} days:`)
  for (const d of dayMap) {
    log(`  W${d.weekNum}D${d.dayNum} → idx:${d.containerIdx}, ${d.exerciseCount} exercises`)
  }

  for (const week of mhrpPart1.weeks) {
    const wn = week.weekNumber
    if (CONFIG.onlyWeeks.length > 0 && !CONFIG.onlyWeeks.includes(wn)) continue
    if (wn < CONFIG.startFromWeek) continue

    log(`\n${'═'.repeat(50)}`)
    log(`WEEK ${wn}: ${week.phase}`)
    log('═'.repeat(50))

    for (let dayIdx = 0; dayIdx < week.days.length; dayIdx++) {
      const day = week.days[dayIdx]
      const dayNum = dayIdx + 1
      if (wn === CONFIG.startFromWeek && dayNum < CONFIG.startFromDay) continue

      let dayInfo = dayMap.find(d => d.weekNum === wn && d.dayNum === dayNum)
      log(`\n  Day ${dayNum}: ${day.name} ${dayInfo ? `(${dayInfo.exerciseCount} exercises)` : '(needs creation)'}`)

      if (!dayInfo) {
        log(`    Creating Day ${dayNum}...`)
        try {
          await clickAddDay(page, wn - 1)
        } catch {
          logError(`Could not click Add Day for week ${wn}`)
          continue
        }
        await sleep(CONFIG.actionDelay)
        dayMap = await buildDayMap(page)
        dayInfo = dayMap.find(d => d.weekNum === wn && d.dayNum === dayNum)
        if (!dayInfo) { logError(`Day ${dayNum} not created`); continue }
        log(`    Created (idx:${dayInfo.containerIdx})`)
      }

      const existingCount = dayInfo.exerciseCount
      if (existingCount >= day.exercises.length) {
        log(`    All ${existingCount} exercises present — skipping`)
        continue
      }

      for (let exIdx = existingCount; exIdx < day.exercises.length; exIdx++) {
        if (wn === CONFIG.startFromWeek && dayNum === CONFIG.startFromDay && exIdx < CONFIG.skipExercises) continue

        const exercise = day.exercises[exIdx]
        log(`    [${exIdx + 1}/${day.exercises.length}] ${exercise.name} (${exercise.sets}x${exercise.reps}${exercise.rpe ? ' @' + exercise.rpe : ''})`)

        try {
          await addExercise(page, dayInfo.containerIdx, exercise)
          log(`    ✓ Done`)
          dayMap = await buildDayMap(page)
          dayInfo = dayMap.find(d => d.weekNum === wn && d.dayNum === dayNum)!
        } catch (e: any) {
          logError(`Failed: ${e.message}`)
          try { await page.screenshot({ path: `scripts/boostcamp/screenshots/err-w${wn}d${dayNum}e${exIdx}.png` }) } catch {}
          try { await clickLastButtonByText(page, 'Cancel', '_cancel') } catch {}
          await sleep(1000)
        }
      }
    }

    if (CONFIG.autoSave) {
      log(`\n  Saving Week ${wn}...`)
      try { await clickLastButtonByText(page, 'Save', '_save') } catch {}
      await sleep(2000)
    }
  }

  log('\n' + '═'.repeat(50))
  log('AUTOMATION COMPLETE!')
  log('═'.repeat(50))
}

main().catch(e => { logError(e.message); process.exit(1) })
