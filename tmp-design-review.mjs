import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SCREENSHOTS = '/tmp/design-review-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
    console.log('[CERR] ' + msg.text());
  }
});
page.on('pageerror', err => console.log('[PERR] ' + err.message));

// Step 1: Set up guest session
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  sessionStorage.setItem('_knowluneE2eBrowserInit', 'true');
});
await page.screenshot({ path: SCREENSHOTS + '/01-home-desktop.png', fullPage: false });
console.log('[INFO] Step 1: Home page loaded');

// Step 2: Library page
await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const libLinks = await page.evaluate(() => {
  return [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h);
});
const courseLinks = libLinks.filter(h => h.match(/\/courses\/[^/]+$/));
const lessonLinks = libLinks.filter(h => h.includes('/lessons/'));
console.log('[INFO] Library links - courses: ' + courseLinks.length + ', lessons: ' + lessonLinks.length);

let lessonUrl = null;
let courseId = null;

if (lessonLinks.length > 0) {
  lessonUrl = lessonLinks[0];
  courseId = lessonUrl.split('/courses/')[1]?.split('/lessons/')[0];
  console.log('[INFO] Found lesson directly on library: ' + lessonUrl);
} else if (courseLinks.length > 0) {
  // Navigate to each course to find lessons
  for (const cl of courseLinks.slice(0, 5)) {
    const cid = cl.split('/courses/')[1]?.split('?')[0];
    if (!cid) continue;
    await page.goto(BASE + '/courses/' + cid, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const found = await page.evaluate(() => {
      return [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h && h.includes('/lessons/'));
    });
    if (found.length > 0) {
      courseId = cid;
      lessonUrl = found[0];
      console.log('[INFO] Found lesson on course ' + cid + ': ' + lessonUrl);
      break;
    }
  }
}

if (!lessonUrl) {
  await page.goto(BASE + '/courses', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const cLinks = await page.evaluate(() => {
    return [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => h && h.includes('/lessons/'));
  });
  if (cLinks.length > 0) {
    lessonUrl = cLinks[0];
    courseId = lessonUrl.split('/courses/')[1]?.split('/lessons/')[0];
    console.log('[INFO] Found lesson on courses page: ' + lessonUrl);
  }
}

console.log('[INFO] Final: lessonUrl=' + lessonUrl + ', courseId=' + courseId);

// === LESSON PAGE TESTING ===
if (lessonUrl) {
  const fullUrl = lessonUrl.startsWith('http') ? lessonUrl : BASE + lessonUrl;
  await page.goto(fullUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // R1: Header elements
  const backLink = await page.$('a[aria-label="Back to course"]');
  const theaterToggle = await page.$('[data-testid="theater-mode-toggle"]');
  const notesToggle = await page.$('[data-testid="notes-toggle"]');
  const completionToggle = await page.$('[data-testid="completion-toggle"]');
  const readingToggle = await page.$('[data-testid="reading-mode-toggle"]');

  console.log('[LESSON-DESKTOP] backLink=' + !!backLink + ' theater=' + !!theaterToggle +
    ' notes=' + !!notesToggle + ' completion=' + !!completionToggle + ' reading=' + !!readingToggle);

  // R6: Brand border
  const headerInfo = await page.evaluate(() => {
    const h = document.querySelector('header[role="banner"]');
    if (!h) return { found: false };
    const cs = getComputedStyle(h);
    return {
      found: true,
      borderBottomWidth: cs.borderBottomWidth,
      borderBottomColor: cs.borderBottomColor,
      borderBottomStyle: cs.borderBottomStyle,
    };
  });
  console.log('[LESSON-DESKTOP] Header border: ' + JSON.stringify(headerInfo));

  // R8: Search centering
  const searchInfo = await page.evaluate(() => {
    const search = document.querySelector('[role="search"]');
    const header = document.querySelector('header[role="banner"]');
    if (!search || !header) return null;
    const sr = search.getBoundingClientRect();
    const hr = header.getBoundingClientRect();
    return {
      searchCenter: Math.round(sr.left + sr.width / 2),
      headerCenter: Math.round(hr.left + hr.width / 2),
      delta: Math.round((sr.left + sr.width / 2) - (hr.left + hr.width / 2)),
      searchWidth: Math.round(sr.width),
    };
  });
  console.log('[LESSON-DESKTOP] Search position: ' + JSON.stringify(searchInfo));

  // R7: Old toolbar removed
  const oldToolbar = await page.$('[data-testid="player-header-toolbar"]');
  const stickySentinel = await page.$('[data-sentinel="toolbar"]');
  console.log('[LESSON-DESKTOP] Old toolbar=' + !!oldToolbar + ' sentinel=' + !!stickySentinel);

  // R4: Theater mode hides tools
  const toolsWrapper = await page.$('[data-theater-hide]');
  console.log('[LESSON-DESKTOP] data-theater-hide elements present: ' + !!toolsWrapper);

  await page.screenshot({ path: SCREENSHOTS + '/02-lesson-desktop.png', fullPage: true });

  // === TABLET 768px ===
  await page.setViewportSize({ width: 768, height: 900 });
  await page.waitForTimeout(800);

  const tKebab = await page.$('[data-testid="tablet-kebab-trigger"]');
  const tTheaterInline = await page.$('[data-testid="theater-mode-toggle"]');
  const tNotes = await page.$('[data-testid="notes-toggle"]');
  const tCompletion = await page.$('[data-testid="completion-toggle"]');
  console.log('[TABLET] kebab=' + !!tKebab + ' theaterInline=' + !!tTheaterInline + ' notes=' + !!tNotes + ' completion=' + !!tCompletion);

  const tOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('[TABLET] Horizontal overflow: ' + tOverflow);

  // Click kebab to verify it works
  if (tKebab) {
    await tKebab.click();
    await page.waitForTimeout(300);
    const kebabReading = await page.$('[data-testid="kebab-reading-mode"]');
    const kebabTheater = await page.$('[data-testid="kebab-theater-mode"]');
    console.log('[TABLET-KEBAB] reading=' + !!kebabReading + ' theater=' + !!kebabTheater);
  }

  await page.screenshot({ path: SCREENSHOTS + '/03-lesson-tablet.png', fullPage: true });

  // === MOBILE 375px ===
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);

  const mTheater = await page.$('[data-testid="theater-mode-toggle"]');
  const mLessonNav = await page.$('nav[aria-label="Lesson navigation"]');
  const mStdNav = await page.$('nav[aria-label="Mobile navigation"]');
  const mNotes = await page.$('[data-testid="bottomnav-notes-toggle"]');
  const mCompletion = await page.$('[data-testid="bottomnav-completion-toggle"]');
  const mMore = await page.$('[data-testid="bottomnav-more-trigger"]');
  const mBackLink = await page.$('a[aria-label="Back to course"]');
  console.log('[MOBILE] theaterInHeader=' + !!mTheater + ' lessonNav=' + !!mLessonNav +
    ' stdNav=' + !!mStdNav + ' notesBtn=' + !!mNotes + ' completionBtn=' + !!mCompletion +
    ' moreBtn=' + !!mMore + ' backLink=' + !!mBackLink);

  const mOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('[MOBILE] Horizontal overflow: ' + mOverflow);

  // Check touch targets
  const smallTargets = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, a, [role="button"]')];
    return els
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
      })
      .slice(0, 8)
      .map(el => ({
        tag: el.tagName,
        w: Math.round(el.getBoundingClientRect().width),
        h: Math.round(el.getBoundingClientRect().height),
        label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '',
      }));
  });
  console.log('[MOBILE] Small touch targets: ' + JSON.stringify(smallTargets));

  await page.screenshot({ path: SCREENSHOTS + '/04-lesson-mobile.png', fullPage: true });
} // end lesson tests

// === NON-LESSON PAGE (OVERVIEW) ===
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const ovBack = await page.$('a[aria-label="Back to course"]');
const ovTheater = await page.$('[data-testid="theater-mode-toggle"]');
const ovNotes = await page.$('[data-testid="notes-toggle"]');
const ovBorder = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  return h ? getComputedStyle(h).borderBottomWidth : 'no-header';
});
console.log('[OVERVIEW-DESKTOP] backLink=' + !!ovBack + ' theater=' + !!ovTheater + ' notes=' + !!ovNotes + ' border=' + ovBorder);

await page.screenshot({ path: SCREENSHOTS + '/05-overview-desktop.png', fullPage: false });

// === MOBILE OVERVIEW ===
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(800);
const ovMLessonNav = await page.$('nav[aria-label="Lesson navigation"]');
const ovMStdNav = await page.$('nav[aria-label="Mobile navigation"]');
console.log('[MOBILE-OVERVIEW] lessonNav=' + !!ovMLessonNav + ' stdNav=' + !!ovMStdNav);

await page.screenshot({ path: SCREENSHOTS + '/06-overview-mobile.png', fullPage: false });

// === DARK MODE ===
if (lessonUrl) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + lessonUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: SCREENSHOTS + '/07-lesson-dark-desktop.png', fullPage: false });

  const darkColors = await page.evaluate(() => {
    const h = document.querySelector('header[role="banner"]');
    const bl = document.querySelector('a[aria-label="Back to course"]');
    if (!h || !bl) return null;
    const hcs = getComputedStyle(h);
    const blcs = getComputedStyle(bl);
    return {
      headerBg: hcs.backgroundColor,
      headerBorder: hcs.borderBottomColor,
      backLinkColor: blcs.color,
      backLinkFontSize: blcs.fontSize,
    };
  });
  console.log('[DARK-MODE] Colors: ' + JSON.stringify(darkColors));
}

// === AXE-CORE SCANS ===
if (lessonUrl) {
  // Lesson page light mode
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + lessonUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(300);

  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const axeLesson = await page.evaluate(() => {
    const axe = window.axe;
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
  });
  console.log('[AXE-LESSON] Violations: ' + axeLesson.violations.length + ' Passes: ' + axeLesson.passes.length + ' Incomplete: ' + axeLesson.incomplete.length);
  for (const v of axeLesson.violations) {
    console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
    for (const n of v.nodes.slice(0, 2)) {
      console.log('    -> ' + n.target.join(' '));
    }
  }

  // Lesson page dark mode axe
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.waitForTimeout(300);
  const axeLessonDark = await page.evaluate(() => {
    const axe = window.axe;
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
  });
  const darkViolations = axeLessonDark.violations.filter(v => {
    const lightViolationIds = new Set(axeLesson.violations.map(lv => lv.id));
    return !lightViolationIds.has(v.id) || v.nodes.length > (axeLesson.violations.find(lv => lv.id === v.id)?.nodes.length || 0);
  });
  if (darkViolations.length > 0) {
    console.log('[AXE-LESSON-DARK] New violations in dark mode: ' + darkViolations.length);
    for (const v of darkViolations) {
      console.log('  [DV] ' + v.id + ' (' + v.impact + '): ' + v.description);
    }
  } else {
    console.log('[AXE-LESSON-DARK] No new violations in dark mode');
  }

  // Overview page axe
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.waitForTimeout(300);
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
  const axeOv = await page.evaluate(() => {
    const axe = window.axe;
    return axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
  });
  console.log('[AXE-OVERVIEW] Violations: ' + axeOv.violations.length + ' Passes: ' + axeOv.passes.length);
  for (const v of axeOv.violations) {
    console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
  }
}

// === KEYBOARD ACCESSIBILITY ===
if (lessonUrl) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + lessonUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Tab through page and record focus elements
  const tabSequence = [];
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return {
        tag: el.tagName,
        role: el.getAttribute('role'),
        label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40),
        testid: el.getAttribute('data-testid'),
        visible: el.getBoundingClientRect().width > 0,
      };
    });
    if (focused) tabSequence.push(focused);
  }
  console.log('[KEYBOARD] Tab sequence: ' + JSON.stringify(tabSequence.slice(0, 12)));

  // Check if focus indicators are visible (outline)
  const hasFocusIndicator = await page.evaluate(() => {
    // Trigger focus on a button
    const btn = document.querySelector('button');
    if (!btn) return false;
    btn.focus();
    const cs = getComputedStyle(btn);
    // Check if outline is visible
    return cs.outlineStyle !== 'none' || cs.boxShadow !== 'none';
  });
  console.log('[KEYBOARD] Focus indicator visible: ' + hasFocusIndicator);
}

// === CONSOLE ERRORS ===
console.log('[CONSOLE] Total errors: ' + consoleErrors.length);

await context.close();
await browser.close();
console.log('[DONE] All design review tests completed');
