import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SCREENSHOTS = '/tmp/design-review-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

// Seed guest session BEFORE any navigation
await page.addInitScript(() => {
  sessionStorage.setItem('knowlune-guest', 'true');
  sessionStorage.setItem('knowlune-guest-id', crypto.randomUUID());
  localStorage.setItem('knowlune-sidebar-v1', 'false');
  localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true }));
  localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }));
});

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    const txt = msg.text();
    // Filter known pre-existing sync engine errors
    if (!txt.includes('syncEngine') && !txt.includes('quiz_attempts') && !txt.includes('ai_usage_events')) {
      consoleErrors.push(txt);
      console.log('[CERR] ' + txt);
    }
  }
});
page.on('pageerror', err => console.log('[PERR] ' + err.message));

// ============================================================
// STEP 1: Navigate to library and find courses
// ============================================================
console.log('=== STEP 1: Finding courses ===');
await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const currentUrl = page.url();
console.log('[URL] After library nav: ' + currentUrl);

// Check if we landed on library (not landing)
const pageText = await page.evaluate(() => document.body.innerText);
console.log('[BODY] First 300 chars: ' + pageText.slice(0, 300));

// Check for header
const headerCheck = await page.evaluate(() => {
  const h = document.querySelector('header');
  return h ? { found: true, role: h.getAttribute('role'), height: getComputedStyle(h).height } : { found: false };
});
console.log('[HEADER] ' + JSON.stringify(headerCheck));

await page.screenshot({ path: SCREENSHOTS + '/00-library.png', fullPage: false });

// Find lesson links
const libLinks = await page.evaluate(() => {
  return [...document.querySelectorAll('a')]
    .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim().slice(0, 40) }))
    .filter(l => l.href);
});
const lessonLinks = libLinks.filter(l => l.href && l.href.includes('/lessons/'));
const courseLinks = libLinks.filter(l => l.href && l.href.match(/\/courses\/[^/]+$/) && !l.href.includes('/lessons/'));
console.log('[LINKS] All links: ' + libLinks.length + ', Lessons: ' + lessonLinks.map(l => l.href).slice(0, 5) + ', Courses: ' + courseLinks.map(l => l.href).slice(0, 5));

let lessonUrl = null;
let courseId = null;

// Try direct from library page
if (lessonLinks.length > 0) {
  lessonUrl = lessonLinks[0].href;
  courseId = lessonUrl.split('/courses/')[1]?.split('/lessons/')[0];
} else if (courseLinks.length > 0) {
  // Navigate to first course to find lessons
  for (const cl of courseLinks.slice(0, 3)) {
    const cid = cl.href.split('/courses/')[1]?.split('?')[0];
    if (!cid) continue;
    await page.goto(BASE + '/courses/' + cid, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const found = await page.evaluate(() => {
      return [...document.querySelectorAll('a')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && h.includes('/lessons/'));
    });
    if (found.length > 0) {
      courseId = cid;
      lessonUrl = found[0];
      console.log('[FOUND] Lesson: ' + lessonUrl + ' on course: ' + courseId);
      break;
    }
    console.log('[COURSE] ' + cid + ': ' + found.length + ' lesson links');
  }
}

// Try Library "Continue" tab or any other tab
if (!lessonUrl) {
  // Check Library page for any course content
  const hasImport = await page.evaluate(() => {
    return document.body.innerText.includes('Import') || document.body.innerText.includes('Add');
  });
  console.log('[LIBRARY] Has import/add: ' + hasImport);
  
  // Try different library tabs
  for (const tab of ['browse', 'collections', 'history']) {
    await page.goto(BASE + '/library?tab=' + tab, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const found = await page.evaluate(() => {
      return [...document.querySelectorAll('a')]
        .map(a => a.getAttribute('href'))
        .filter(h => h && h.includes('/lessons/'));
    });
    if (found.length > 0) {
      lessonUrl = found[0];
      courseId = lessonUrl.split('/courses/')[1]?.split('/lessons/')[0];
      console.log('[FOUND] Lesson via tab ' + tab + ': ' + lessonUrl);
      break;
    }
  }
}

// If still no lesson, try direct URLs with known patterns
if (!lessonUrl) {
  console.log('[WARN] No lesson pages found in app. Will test header structure from non-lesson pages.');
  // We can still test the header on non-lesson pages and the course route page
  if (courseLinks.length > 0) {
    courseId = courseLinks[0].href.split('/courses/')[1]?.split('?')[0];
    console.log('[INFO] Will test course sub-page header with courseId=' + courseId);
  }
}

console.log('[RESULT] lessonUrl=' + lessonUrl + ', courseId=' + courseId);

// ============================================================
// STEP 2: Test header on all available page types
// ============================================================

// --- Test 2a: Non-lesson page (Overview) ---
console.log('\n=== STEP 2a: Overview page ===');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const overviewHeader = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) {
    // Check any header
    const anyH = document.querySelector('header');
    if (!anyH) return { found: false, bodyText: document.body.innerText.slice(0, 200) };
    return { found: true, role: anyH.getAttribute('role'), anyHeader: true };
  }
  const cs = getComputedStyle(h);
  return {
    found: true,
    role: 'banner',
    borderBottom: cs.borderBottom,
    borderBottomWidth: cs.borderBottomWidth,
    display: cs.display,
    bg: cs.backgroundColor,
  };
});
console.log('[OVERVIEW HEADER] ' + JSON.stringify(overviewHeader));

const ovBackLink = await page.$('a[aria-label="Back to course"]');
const ovLessonTools = await page.$('[data-testid="theater-mode-toggle"]');
console.log('[OVERVIEW] backLink=' + !!ovBackLink + ' lessonTools=' + !!ovLessonTools);

// Check search
const ovSearch = await page.$('[role="search"]');
console.log('[OVERVIEW] search=' + !!ovSearch);

await page.screenshot({ path: SCREENSHOTS + '/05-overview-desktop.png', fullPage: false });

// --- Test 2b: Course sub-page if courseId available ---
if (courseId) {
  console.log('\n=== STEP 2b: Course sub-page ===');
  await page.goto(BASE + '/courses/' + courseId, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const courseHeader = await page.evaluate(() => {
    const h = document.querySelector('header[role="banner"]');
    if (!h) return { found: false };
    const cs = getComputedStyle(h);
    return {
      found: true,
      borderBottomWidth: cs.borderBottomWidth,
      display: cs.display,
    };
  });
  console.log('[COURSE-HEADER] ' + JSON.stringify(courseHeader));

  const cBackLink = await page.$('a[aria-label="Back to course"]');
  const cLessonTools = await page.$('[data-testid="theater-mode-toggle"]');
  console.log('[COURSE-SUB] backLink=' + !!cBackLink + ' lessonTools=' + !!cLessonTools);

  await page.screenshot({ path: SCREENSHOTS + '/02b-course-sub-page.png', fullPage: false });
}

// --- Test 2c: Lesson page if available ---
if (lessonUrl) {
  console.log('\n=== STEP 2c: Lesson page ===');
  const fullUrl = lessonUrl.startsWith('http') ? lessonUrl : BASE + lessonUrl;
  await page.goto(fullUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const lessonHeader = await page.evaluate(() => {
    const h = document.querySelector('header[role="banner"]');
    if (!h) return { found: false };
    const cs = getComputedStyle(h);
    return {
      found: true,
      borderBottomWidth: cs.borderBottomWidth,
      borderBottomColor: cs.borderBottomColor,
      borderBottomStyle: cs.borderBottomStyle,
      bg: cs.backgroundColor,
    };
  });
  console.log('[LESSON-HEADER] ' + JSON.stringify(lessonHeader));

  // Check all required elements
  const backLink = await page.$('a[aria-label="Back to course"]');
  const theaterToggle = await page.$('[data-testid="theater-mode-toggle"]');
  const notesToggle = await page.$('[data-testid="notes-toggle"]');
  const completionToggle = await page.$('[data-testid="completion-toggle"]');
  const readingToggle = await page.$('[data-testid="reading-mode-toggle"]');
  const oldToolbar = await page.$('[data-testid="player-header-toolbar"]');
  const searchEl = await page.$('[role="search"]');

  console.log('[LESSON] backLink=' + !!backLink + ' theater=' + !!theaterToggle + 
    ' notes=' + !!notesToggle + ' completion=' + !!completionToggle + 
    ' reading=' + !!readingToggle + ' oldToolbar=' + !!oldToolbar + ' search=' + !!searchEl);
  
  await page.screenshot({ path: SCREENSHOTS + '/02-lesson-desktop.png', fullPage: true });

  // --- Tablet 768px ---
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForTimeout(800);

  const tKebab = await page.$('[data-testid="tablet-kebab-trigger"]');
  const tTheater = await page.$('[data-testid="theater-mode-toggle"]');
  const tNotes = await page.$('[data-testid="notes-toggle"]');
  const tCompletion = await page.$('[data-testid="completion-toggle"]');
  console.log('[TABLET] kebab=' + !!tKebab + ' theater=' + !!tTheater + ' notes=' + !!tNotes + ' completion=' + !!tCompletion);

  const tOverflow = await page.evaluate(() => 
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log('[TABLET] Overflow=' + tOverflow);

  // Test kebab
  if (tKebab) {
    await tKebab.click();
    await page.waitForTimeout(400);
    const kItems = await page.evaluate(() => {
      return [...document.querySelectorAll('[data-testid^="kebab-"]')]
        .map(el => el.getAttribute('data-testid'));
    });
    console.log('[TABLET-KEBAB] Items: ' + JSON.stringify(kItems));
  }
  await page.screenshot({ path: SCREENSHOTS + '/03-lesson-tablet.png', fullPage: true });

  // --- Mobile 375px ---
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);

  const mTheater = await page.$('[data-testid="theater-mode-toggle"]');
  const mLessonNav = await page.$('nav[aria-label="Lesson navigation"]');
  const mStdNav = await page.$('nav[aria-label="Mobile navigation"]');
  const mNotes = await page.$('[data-testid="bottomnav-notes-toggle"]');
  const mCompletion = await page.$('[data-testid="bottomnav-completion-toggle"]');
  const mMore = await page.$('[data-testid="bottomnav-more-trigger"]');
  const mBackLink = await page.$('a[aria-label="Back to course"]');

  console.log('[MOBILE] theaterHeader=' + !!mTheater + ' lessonNav=' + !!mLessonNav + 
    ' stdNav=' + !!mStdNav + ' notesBtn=' + !!mNotes + ' completionBtn=' + !!mCompletion +
    ' moreBtn=' + !!mMore + ' backLink=' + !!mBackLink);

  const mOverflow = await page.evaluate(() => 
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log('[MOBILE] Overflow=' + mOverflow);

  const smallTargets = await page.evaluate(() => {
    return [...document.querySelectorAll('button, a, [role="button"]')]
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      })
      .slice(0, 8)
      .map(el => ({
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
        label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 25) || '',
      }));
  });
  console.log('[MOBILE] Small touch targets (<44px): ' + JSON.stringify(smallTargets));

  await page.screenshot({ path: SCREENSHOTS + '/04-lesson-mobile.png', fullPage: true });

  // --- Dark mode ---
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(fullUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: SCREENSHOTS + '/07-lesson-dark-desktop.png', fullPage: false });

  const darkInfo = await page.evaluate(() => {
    const h = document.querySelector('header[role="banner"]');
    const bl = document.querySelector('a[aria-label="Back to course"]');
    if (!h) return null;
    const hcs = getComputedStyle(h);
    return {
      headerBg: hcs.backgroundColor,
      headerBorderColor: hcs.borderBottomColor,
      backLinkColor: bl ? getComputedStyle(bl).color : null,
    };
  });
  console.log('[DARK] ' + JSON.stringify(darkInfo));

  // --- Axe-core scan ---
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(300);
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const axeRes = await page.evaluate(() => {
    return window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
  });
  console.log('[AXE-LESSON] Violations=' + axeRes.violations.length + ' Passes=' + axeRes.passes.length + ' Incomplete=' + axeRes.incomplete.length);
  for (const v of axeRes.violations) {
    console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
    for (const n of v.nodes.slice(0, 2)) {
      console.log('    -> ' + n.target.join(' '));
    }
  }

  // Axe in dark mode
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  const axeDark = await page.evaluate(() => {
    return window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
  });
  if (axeDark.violations.length > 0) {
    console.log('[AXE-DARK] Violations=' + axeDark.violations.length);
    for (const v of axeDark.violations) {
      console.log('  [DV] ' + v.id + ' (' + v.impact + '): ' + v.description);
    }
  } else {
    console.log('[AXE-DARK] No violations');
  }

  // --- Keyboard navigation ---
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.goto(fullUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const tabSeq = [];
  // Start by focusing the skip link or first focusable
  await page.keyboard.press('Tab');
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(150);
    const f = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName,
        label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30),
        testid: el.getAttribute('data-testid'),
        visible: el.getBoundingClientRect().width > 0,
      };
    });
    if (f) tabSeq.push(f);
    await page.keyboard.press('Tab');
  }
  console.log('[TAB-SEQ] ' + JSON.stringify(tabSeq.slice(0, 10)));
}

// --- Overview page axe ---
console.log('\n=== Axe: Overview ===');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
const axeOv = await page.evaluate(() => {
  return window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  });
});
console.log('[AXE-OVERVIEW] Violations=' + axeOv.violations.length + ' Passes=' + axeOv.passes.length);
for (const v of axeOv.violations.slice(0, 5)) {
  console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
}
await page.screenshot({ path: SCREENSHOTS + '/06-overview-mobile.png' });

// --- Mobile overview BottomNav check ---
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(800);
const mobLessonNav = await page.$('nav[aria-label="Lesson navigation"]');
const mobStdNav = await page.$('nav[aria-label="Mobile navigation"]');
console.log('[MOBILE-OV] lessonNav=' + !!mobLessonNav + ' stdNav=' + !!mobStdNav);

// --- Console errors ---
console.log('\n[CONSOLE] New errors (excluding sync engine): ' + consoleErrors.length);
for (const e of consoleErrors.slice(0, 10)) {
  console.log('  ' + e.slice(0, 120));
}

await context.close();
await browser.close();
console.log('\n[DONE] All tests completed');
