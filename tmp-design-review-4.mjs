import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SCREENSHOTS = '/tmp/design-review-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
// Bypass CSP so we can load axe-core
const context = await browser.newContext({ 
  viewport: { width: 1440, height: 900 },
  bypassCSP: true,
});
const page = await context.newPage();

// Seed guest session
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
    if (!txt.includes('syncEngine') && !txt.includes('quiz_attempts') && !txt.includes('ai_usage_events')) {
      consoleErrors.push(txt);
      console.log('[CERR] ' + txt.slice(0, 150));
    }
  }
});
page.on('pageerror', err => console.log('[PERR] ' + err.message));

// First navigate to home so guest session initializes
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// ============================================================
// TEST 1: Non-lesson page (Overview) - verify normal header
// ============================================================
console.log('\n=== TEST 1: Overview (non-lesson page) ===');
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const ovInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return { error: 'no header' };
  const cs = getComputedStyle(h);
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const lessonTools = document.querySelector('[data-testid="theater-mode-toggle"]');
  const search = document.querySelector('[role="search"]');
  return {
    borderBottomWidth: cs.borderBottomWidth,
    borderBottomStyle: cs.borderBottomStyle,
    backLinkExists: !!backLink,
    lessonToolsExist: !!lessonTools,
    searchExists: !!search,
    headerBg: cs.backgroundColor,
  };
});
console.log('[OVERVIEW] ' + JSON.stringify(ovInfo, null, 2));

await page.screenshot({ path: SCREENSHOTS + '/01-overview-desktop.png', fullPage: false });

// ============================================================
// TEST 2: Course sub-page (not a lesson) - should show back link, no tools, no brand border
// ============================================================
console.log('\n=== TEST 2: Course sub-page (/courses/test-course-1) ===');
await page.goto(BASE + '/courses/test-course-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const courseInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return { error: 'no header', bodyText: document.body.innerText.slice(0, 300) };
  const cs = getComputedStyle(h);
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const lessonTools = document.querySelector('[data-testid="theater-mode-toggle"]');
  const search = document.querySelector('[role="search"]');
  const backLinkText = backLink ? backLink.textContent?.trim() : null;
  const backLinkHref = backLink ? backLink.getAttribute('href') : null;
  return {
    borderBottomWidth: cs.borderBottomWidth,
    borderBottomStyle: cs.borderBottomStyle,
    backLinkExists: !!backLink,
    backLinkText,
    backLinkHref,
    lessonToolsExist: !!lessonTools,
    searchExists: !!search,
    headerBg: cs.backgroundColor,
  };
});
console.log('[COURSE-SUB] ' + JSON.stringify(courseInfo, null, 2));

await page.screenshot({ path: SCREENSHOTS + '/02-course-sub-desktop.png', fullPage: false });

// ============================================================
// TEST 3: Lesson page - should show back link, all tools, brand border
// ============================================================
console.log('\n=== TEST 3: Lesson page (/courses/test-course-1/lessons/test-lesson-1) ===');
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const lessonInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return { error: 'no header' };
  const cs = getComputedStyle(h);
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const backLinkText = backLink ? backLink.textContent?.trim() : null;
  const backLinkHref = backLink ? backLink.getAttribute('href') : null;
  const theater = document.querySelector('[data-testid="theater-mode-toggle"]');
  const notes = document.querySelector('[data-testid="notes-toggle"]');
  const reading = document.querySelector('[data-testid="reading-mode-toggle"]');
  const completion = document.querySelector('[data-testid="completion-toggle"]');
  const search = document.querySelector('[role="search"]');
  const oldToolbar = document.querySelector('[data-testid="player-header-toolbar"]');
  
  return {
    borderBottomWidth: cs.borderBottomWidth,
    borderBottomColor: cs.borderBottomColor,
    borderBottomStyle: cs.borderBottomStyle,
    headerClasses: h.className,
    backLinkExists: !!backLink,
    backLinkText,
    backLinkHref,
    theaterExists: !!theater,
    notesExists: !!notes,
    readingExists: !!reading,
    completionExists: !!completion,
    completionVisible: completion ? getComputedStyle(completion).display !== 'none' : false,
    searchExists: !!search,
    oldToolbarExists: !!oldToolbar,
  };
});
console.log('[LESSON] ' + JSON.stringify(lessonInfo, null, 2));

// Check if content is rendering or showing an error state
const lessonBody = await page.evaluate(() => document.querySelector('main')?.innerText?.slice(0, 300) || document.body.innerText.slice(0, 300));
console.log('[LESSON-BODY] ' + lessonBody);

await page.screenshot({ path: SCREENSHOTS + '/03-lesson-desktop.png', fullPage: true });

// ============================================================
// TEST 4: Quiz sub-route - should show back link, NO tools, NO brand border
// /courses/:courseId/lessons/:lessonId/quiz
// ============================================================
console.log('\n=== TEST 4: Quiz sub-route ===');
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1/quiz', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const quizInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return { error: 'no header' };
  const cs = getComputedStyle(h);
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const lessonTools = document.querySelector('[data-testid="theater-mode-toggle"]');
  return {
    borderBottomWidth: cs.borderBottomWidth,
    backLinkExists: !!backLink,
    lessonToolsExist: !!lessonTools,
  };
});
console.log('[QUIZ] ' + JSON.stringify(quizInfo, null, 2));

await page.screenshot({ path: SCREENSHOTS + '/04-quiz-desktop.png', fullPage: false });

// ============================================================
// TEST 5: Flashcards sub-route - should show back link, NO tools, NO brand border
// ============================================================
console.log('\n=== TEST 5: Flashcards ===');
await page.goto(BASE + '/courses/test-course-1/flashcards', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const fcInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return { error: 'no header' };
  const cs = getComputedStyle(h);
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const lessonTools = document.querySelector('[data-testid="theater-mode-toggle"]');
  return {
    borderBottomWidth: cs.borderBottomWidth,
    backLinkExists: !!backLink,
    lessonToolsExist: !!lessonTools,
  };
});
console.log('[FLASHCARDS] ' + JSON.stringify(fcInfo, null, 2));

// ============================================================
// TEST 6: Tablet responsive (768px) on lesson page
// ============================================================
console.log('\n=== TEST 6: Tablet responsive (768px) ===');
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.setViewportSize({ width: 768, height: 900 });
await page.waitForTimeout(800);

const tabletInfo = await page.evaluate(() => {
  const kebab = document.querySelector('[data-testid="tablet-kebab-trigger"]');
  const theater = document.querySelector('[data-testid="theater-mode-toggle"]');
  const notes = document.querySelector('[data-testid="notes-toggle"]');
  const completion = document.querySelector('[data-testid="completion-toggle"]');
  
  // Check visibility via computed display
  const theaterDisplay = theater ? getComputedStyle(theater).display : 'absent';
  const kebabDisplay = kebab ? getComputedStyle(kebab).display : 'absent';
  const notesDisplay = notes ? getComputedStyle(notes).display : 'absent';
  const completionDisplay = completion ? getComputedStyle(completion).display : 'absent';
  
  return {
    kebabDisplay,
    theaterDisplay,
    notesDisplay,
    completionDisplay,
    viewportWidth: window.innerWidth,
  };
});
console.log('[TABLET] ' + JSON.stringify(tabletInfo, null, 2));

// Check horizontal overflow
const tabletOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log('[TABLET] Horizontal overflow: ' + tabletOverflow);

await page.screenshot({ path: SCREENSHOTS + '/05-lesson-tablet.png', fullPage: true });

// Click kebab to verify dropdown
const kebabBtn = await page.$('[data-testid="tablet-kebab-trigger"]');
if (kebabBtn) {
  await kebabBtn.click();
  await page.waitForTimeout(400);
  const kebabItems = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-testid^="kebab-"]')]
      .map(el => ({ id: el.getAttribute('data-testid'), text: el.textContent?.trim() }));
  });
  console.log('[TABLET-KEBAB] Items: ' + JSON.stringify(kebabItems));
}

// ============================================================
// TEST 7: Mobile responsive (375px) on lesson page
// ============================================================
console.log('\n=== TEST 7: Mobile responsive (375px) ===');
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(800);

const mobileInfo = await page.evaluate(() => {
  const lessonNav = document.querySelector('nav[aria-label="Lesson navigation"]');
  const stdNav = document.querySelector('nav[aria-label="Mobile navigation"]');
  const theater = document.querySelector('[data-testid="theater-mode-toggle"]');
  const notes = document.querySelector('[data-testid="bottomnav-notes-toggle"]');
  const completion = document.querySelector('[data-testid="bottomnav-completion-toggle"]');
  const more = document.querySelector('[data-testid="bottomnav-more-trigger"]');
  const headerBackLink = document.querySelector('a[aria-label="Back to course"]');
  
  const lessonNavDisplay = lessonNav ? getComputedStyle(lessonNav).display : 'absent';
  const stdNavDisplay = stdNav ? getComputedStyle(stdNav).display : 'absent';
  const theaterDisplay = theater ? getComputedStyle(theater).display : 'absent';
  
  return {
    lessonNavDisplay,
    stdNavDisplay,
    theaterDisplay,
    notesExists: !!notes,
    completionExists: !!completion,
    moreExists: !!more,
    headerBackLinkExists: !!headerBackLink,
    viewportWidth: window.innerWidth,
  };
});
console.log('[MOBILE] ' + JSON.stringify(mobileInfo, null, 2));

const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log('[MOBILE] Horizontal overflow: ' + mobileOverflow);

await page.screenshot({ path: SCREENSHOTS + '/06-lesson-mobile.png', fullPage: true });

// ============================================================
// TEST 8: Mobile non-lesson page - standard BottomNav
// ============================================================
console.log('\n=== TEST 8: Mobile non-lesson ===');
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(800);

const mobileNonLessonInfo = await page.evaluate(() => {
  const lessonNav = document.querySelector('nav[aria-label="Lesson navigation"]');
  const stdNav = document.querySelector('nav[aria-label="Mobile navigation"]');
  return {
    lessonNav: lessonNav ? getComputedStyle(lessonNav).display : 'absent',
    stdNav: stdNav ? getComputedStyle(stdNav).display : 'absent',
  };
});
console.log('[MOBILE-OVERVIEW] ' + JSON.stringify(mobileNonLessonInfo));

await page.screenshot({ path: SCREENSHOTS + '/07-overview-mobile.png', fullPage: false });

// ============================================================
// TEST 9: Dark mode
// ============================================================
console.log('\n=== TEST 9: Dark mode ===');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Toggle dark mode via theme class
await page.evaluate(() => document.documentElement.classList.add('dark'));
await page.waitForTimeout(500);

const darkInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const notesBtn = document.querySelector('[data-testid="notes-toggle"]');
  const completionBtn = document.querySelector('[data-testid="completion-toggle"]');
  
  if (!h) return { error: 'no header' };
  const hcs = getComputedStyle(h);
  
  return {
    headerBg: hcs.backgroundColor,
    headerBorderColor: hcs.borderBottomColor,
    headerBorderWidth: hcs.borderBottomWidth,
    backLinkColor: backLink ? getComputedStyle(backLink).color : null,
    notesBtnBg: notesBtn ? getComputedStyle(notesBtn).backgroundColor : null,
    notesBtnColor: notesBtn ? getComputedStyle(notesBtn).color : null,
    completionBtnColor: completionBtn ? getComputedStyle(completionBtn).color : null,
  };
});
console.log('[DARK] ' + JSON.stringify(darkInfo, null, 2));

await page.screenshot({ path: SCREENSHOTS + '/08-lesson-dark-desktop.png', fullPage: false });

// ============================================================
// TEST 10: Axe-core accessibility scan (with bypassCSP)
// ============================================================
console.log('\n=== TEST 10: Axe-core scans ===');

// Lesson page
await page.evaluate(() => document.documentElement.classList.remove('dark'));
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
const axeLesson = await page.evaluate(() => {
  return window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  });
});
console.log('[AXE-LESSON] Violations=' + axeLesson.violations.length + ' Passes=' + axeLesson.passes.length + ' Incomplete=' + axeLesson.incomplete.length);
for (const v of axeLesson.violations) {
  console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
  for (const n of v.nodes.slice(0, 2)) {
    console.log('    -> ' + n.target.join(' '));
  }
}

// Overview page
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
const axeOv = await page.evaluate(() => {
  return window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  });
});
console.log('[AXE-OVERVIEW] Violations=' + axeOv.violations.length + ' Passes=' + axeOv.passes.length + ' Incomplete=' + axeOv.incomplete.length);
for (const v of axeOv.violations) {
  console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
}

// Course sub-page
await page.goto(BASE + '/courses/test-course-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
const axeCourse = await page.evaluate(() => {
  return window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  });
});
console.log('[AXE-COURSE] Violations=' + axeCourse.violations.length + ' Passes=' + axeCourse.passes.length);
for (const v of axeCourse.violations) {
  console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
}

// Lesson page dark mode
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.evaluate(() => document.documentElement.classList.add('dark'));
await page.waitForTimeout(300);
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
const axeDark = await page.evaluate(() => {
  return window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
  });
});
if (axeDark.violations.length > 0) {
  console.log('[AXE-DARK] Violations=' + axeDark.violations.length);
  for (const v of axeDark.violations) {
    console.log('  [V] ' + v.id + ' (' + v.impact + '): ' + v.description);
  }
} else {
  console.log('[AXE-DARK] No violations!');
}

// ============================================================
// TEST 11: Keyboard navigation tab order
// ============================================================
console.log('\n=== TEST 11: Keyboard tab order ===');
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => document.documentElement.classList.remove('dark'));
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Start tabbing
await page.keyboard.press('Tab');
const tabSeq = [];
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(150);
  const f = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    return {
      tag: el.tagName,
      label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || '',
      role: el.getAttribute('role'),
      testid: el.getAttribute('data-testid'),
      visible: el.getBoundingClientRect().width > 0,
    };
  });
  if (f) tabSeq.push(f);
  await page.keyboard.press('Tab');
}
console.log('[TAB-SEQ] Focus order:');
tabSeq.slice(0, 12).forEach((f, i) => {
  console.log('  ' + i + ': ' + f.tag + ' [' + (f.label || f.testid || f.role || '') + '] visible=' + f.visible);
});

// ============================================================
// TEST 12: Search centering
// ============================================================
console.log('\n=== TEST 12: Search position ===');
const searchPos = await page.evaluate(() => {
  const search = document.querySelector('[role="search"]');
  const header = document.querySelector('header[role="banner"]');
  if (!search || !header) return null;
  const sr = search.getBoundingClientRect();
  const hr = header.getBoundingClientRect();
  return {
    searchCenter: Math.round(sr.left + sr.width / 2),
    headerCenter: Math.round(hr.left + hr.width / 2),
    delta: Math.round((sr.left + sr.width / 2) - (hr.left + hr.width / 2)),
    searchLeft: Math.round(sr.left),
    searchWidth: Math.round(sr.width),
    headerWidth: Math.round(hr.width),
  };
});
console.log(JSON.stringify(searchPos, null, 2));

// ============================================================
// TEST 13: Layout shift / space check
// ============================================================
console.log('\n=== TEST 13: Spacing checks ===');
const spacing = await page.evaluate(() => {
  const header = document.querySelector('header[role="banner"]');
  if (!header) return null;
  const hcs = getComputedStyle(header);
  return {
    headerPadding: hcs.padding,
    headerMargin: hcs.margin,
    headerHeight: hcs.height,
    headerGap: hcs.gap,
  };
});
console.log(JSON.stringify(spacing, null, 2));

// ============================================================
// TEST 14: Back link destination and behavior
// ============================================================
console.log('\n=== TEST 14: Back link behavior ===');
const backLinkInfo = await page.evaluate(() => {
  const link = document.querySelector('a[aria-label="Back to course"]');
  if (!link) return { error: 'no back link' };
  const cs = getComputedStyle(link);
  return {
    href: link.getAttribute('href'),
    text: link.textContent?.trim(),
    color: cs.color,
    fontSize: cs.fontSize,
    display: cs.display,
  };
});
console.log(JSON.stringify(backLinkInfo, null, 2));

// ============================================================
// Console errors summary
// ============================================================
console.log('\n=== CONSOLE ERRORS ===');
console.log('Total new errors (excluding sync engine): ' + consoleErrors.length);
for (const e of consoleErrors.slice(0, 10)) {
  console.log('  ' + e.slice(0, 150));
}

await context.close();
await browser.close();
console.log('\n[DONE] All design review tests completed');
