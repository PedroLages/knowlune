import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SCREENSHOTS = '/tmp/design-review-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ 
  viewport: { width: 1440, height: 900 },
  bypassCSP: true,
});
const page = await context.newPage();

await page.addInitScript(() => {
  sessionStorage.setItem('knowlune-guest', 'true');
  sessionStorage.setItem('knowlune-guest-id', crypto.randomUUID());
  localStorage.setItem('knowlune-sidebar-v1', 'false');
  localStorage.setItem('knowlune-onboarding-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true }));
  localStorage.setItem('knowlune-welcome-wizard-v1', JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }));
});

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// ============================================================
// TEST: Search/kebab overlap at tablet (768px)
// ============================================================
console.log('=== SEARCH/KEBAB OVERLAP TEST ===');
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.setViewportSize({ width: 768, height: 900 });
await page.waitForTimeout(800);

const overlapInfo = await page.evaluate(() => {
  const kebab = document.querySelector('[data-testid="tablet-kebab-trigger"]');
  const searchWrapper = document.querySelector('[role="search"]')?.parentElement;
  const header = document.querySelector('header[role="banner"]');
  
  if (!kebab || !searchWrapper || !header) return { error: 'missing elements' };
  
  const kr = kebab.getBoundingClientRect();
  const sr = searchWrapper.getBoundingClientRect();
  const hr = header.getBoundingClientRect();
  
  // Check if search overlaps with left section of header
  const leftSection = header.querySelector('.flex.items-center.gap-3');
  const lr = leftSection ? leftSection.getBoundingClientRect() : null;
  
  return {
    kebab: { left: Math.round(kr.left), right: Math.round(kr.right), width: Math.round(kr.width) },
    search: { left: Math.round(sr.left), right: Math.round(sr.right), width: Math.round(sr.width) },
    header: { left: Math.round(hr.left), right: Math.round(hr.right), width: Math.round(hr.width) },
    leftSection: lr ? { left: Math.round(lr.left), right: Math.round(lr.right) } : null,
    overlapsLeft: lr ? sr.left < lr.right : null,
    overlapPx: lr ? Math.round(lr.right - sr.left) : null,
  };
});
console.log(JSON.stringify(overlapInfo, null, 2));

// ============================================================
// TEST: Verify effective visibility of theater/reading toggles at 768px
// ============================================================
const tabletVisibility = await page.evaluate(() => {
  const theater = document.querySelector('[data-testid="theater-mode-toggle"]');
  const reading = document.querySelector('[data-testid="reading-mode-toggle"]');
  const notes = document.querySelector('[data-testid="notes-toggle"]');
  const kebab = document.querySelector('[data-testid="tablet-kebab-trigger"]');
  
  return {
    theater: theater ? {
      rectWidth: Math.round(theater.getBoundingClientRect().width),
      offsetParent: theater.offsetParent !== null,
      computedDisplay: getComputedStyle(theater).display,
    } : 'missing',
    reading: reading ? {
      rectWidth: Math.round(reading.getBoundingClientRect().width),
      offsetParent: reading.offsetParent !== null,
    } : 'missing',
    notes: notes ? {
      rectWidth: Math.round(notes.getBoundingClientRect().width),
      offsetParent: notes.offsetParent !== null,
    } : 'missing',
    kebab: kebab ? {
      rectWidth: Math.round(kebab.getBoundingClientRect().width),
      offsetParent: kebab.offsetParent !== null,
    } : 'missing',
  };
});
console.log('[TABLET-VISIBILITY] ' + JSON.stringify(tabletVisibility, null, 2));

await page.screenshot({ path: SCREENSHOTS + '/09-tablet-overlap.png', fullPage: false });

// ============================================================
// TEST: Mobile lesson page (full test)
// ============================================================
console.log('\n=== MOBILE LESSON PAGE TEST ===');
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(800);

const mobileFull = await page.evaluate(() => {
  const lessonNav = document.querySelector('nav[aria-label="Lesson navigation"]');
  const stdNav = document.querySelector('nav[aria-label="Mobile navigation"]');
  const theater = document.querySelector('[data-testid="theater-mode-toggle"]');
  const notesBtn = document.querySelector('[data-testid="bottomnav-notes-toggle"]');
  const completionBtn = document.querySelector('[data-testid="bottomnav-completion-toggle"]');
  const moreBtn = document.querySelector('[data-testid="bottomnav-more-trigger"]');
  const headerBackLink = document.querySelector('a[aria-label="Back to course"]');
  const moreDrawer = document.querySelector('[data-testid="more-drawer"]');
  
  // Get actual rendered state
  const lessonNavInfo = lessonNav ? {
    visible: lessonNav.getBoundingClientRect().height > 0,
    ariaLabel: lessonNav.getAttribute('aria-label'),
    rect: { bottom: Math.round(lessonNav.getBoundingClientRect().bottom), height: Math.round(lessonNav.getBoundingClientRect().height) },
  } : { visible: false };
  
  const stdNavInfo = stdNav ? {
    visible: stdNav.getBoundingClientRect().height > 0,
    ariaLabel: stdNav.getAttribute('aria-label'),
  } : { visible: false };
  
  return {
    lessonNav: lessonNavInfo,
    stdNav: stdNavInfo,
    theaterInHeader: theater ? theater.getBoundingClientRect().width > 0 : false,
    bottomNavNotes: !!notesBtn,
    bottomNavCompletion: !!completionBtn,
    bottomNavMore: !!moreBtn,
    headerBackLink: headerBackLink ? headerBackLink.getBoundingClientRect().width > 0 : false,
    moreDrawerExists: !!moreDrawer,
  };
});
console.log(JSON.stringify(mobileFull, null, 2));

// Check touch targets
const touchTargets = await page.evaluate(() => {
  return [...document.querySelectorAll('button, a, [role="button"]')]
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    })
    .slice(0, 30)
    .map(el => {
      const r = el.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        label: (el.getAttribute('aria-label') || el.textContent?.trim() || '').slice(0, 30),
        below44: r.width < 44 || r.height < 44,
      };
    })
    .filter(t => t.below44);
});
console.log('[MOBILE] Small touch targets (<44px): ' + JSON.stringify(touchTargets.slice(0, 8)));

const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
console.log('[MOBILE] Horizontal overflow: ' + mobileOverflow);

await page.screenshot({ path: SCREENSHOTS + '/10-mobile-lesson-full.png', fullPage: true });

// ============================================================
// TEST: Mobile non-lesson page - standard BottomNav
// ============================================================
console.log('\n=== MOBILE OVERVIEW TEST ===');
await page.goto(BASE + '/overview', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(800);

const mobileOv = await page.evaluate(() => {
  const lessonNav = document.querySelector('nav[aria-label="Lesson navigation"]');
  const stdNav = document.querySelector('nav[aria-label="Mobile navigation"]');
  return {
    lessonNavVisible: lessonNav ? lessonNav.getBoundingClientRect().height > 0 : false,
    stdNavVisible: stdNav ? stdNav.getBoundingClientRect().height > 0 : false,
  };
});
console.log('[MOBILE-OV] ' + JSON.stringify(mobileOv));

await page.screenshot({ path: SCREENSHOTS + '/11-mobile-overview-full.png', fullPage: true });

// ============================================================
// TEST: Brand border color verification
// ============================================================
console.log('\n=== BRAND BORDER VERIFICATION ===');
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE + '/courses/test-course-1/lessons/test-lesson-1', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const brandInfo = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return null;
  const cs = getComputedStyle(h);
  
  // Get the CSS variable for brand color
  const brandVar = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim();
  
  // Parse the bottom border color
  const borderColor = cs.borderBottomColor;
  
  // Check if border color matches brand color
  const rootStyles = getComputedStyle(document.documentElement);
  const brandHex = rootStyles.getPropertyValue('--color-brand'); // might be different var name
  
  return {
    borderBottom: cs.borderBottom,
    borderBottomColor,
    borderBottomWidth: cs.borderBottomWidth,
    brandVar: brandVar.slice(0, 50),
    headerClass: h.className.slice(0, 120),
  };
});
console.log(JSON.stringify(brandInfo, null, 2));

// ============================================================
// TEST: data-theater-hide behavior  
// ============================================================
console.log('\n=== DATA-THEATER-HIDE TEST ===');
const theaterHideEls = await page.evaluate(() => {
  return [...document.querySelectorAll('[data-theater-hide]')]
    .map(el => ({
      tag: el.tagName,
      class: el.className?.slice(0, 60) || '',
      role: el.getAttribute('role'),
    }));
});
console.log('[THEATER-HIDE] Elements with data-theater-hide: ' + theaterHideEls.length);
theaterHideEls.forEach(e => console.log('  ' + e.tag + ' role=' + e.role + ' class=' + e.class));

// Check if LessonHeaderTools wrapper has data-theater-hide
const toolsHasHide = await page.evaluate(() => {
  const tools = document.querySelector('[data-testid="theater-mode-toggle"]');
  if (!tools) return false;
  // Walk up to find data-theater-hide
  let el = tools.parentElement;
  while (el) {
    if (el.hasAttribute('data-theater-hide')) return true;
    el = el.parentElement;
  }
  return false;
});
console.log('[THEATER-HIDE] Lesson tools have data-theater-hide ancestor: ' + toolsHasHide);

// ============================================================
// TEST: Check for hardcoded colors in the changed files
// ============================================================
console.log('\n=== HARDCODED COLORS CHECK (deferred to grep) ===');

// Check the header background vs theme token  
const bgCheck = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return null;
  const cs = getComputedStyle(h);
  const bgVar = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
  return {
    actualBg: cs.backgroundColor,
    cardVar: bgVar.slice(0, 50),
  };
});
console.log('[BG-TOKEN] ' + JSON.stringify(bgCheck));

// ============================================================
// TEST: Spacing and layout measurements
// ============================================================
console.log('\n=== SPACING MEASUREMENTS ===');
await page.setViewportSize({ width: 1440, height: 900 });
const spacing = await page.evaluate(() => {
  const h = document.querySelector('header[role="banner"]');
  if (!h) return null;
  const cs = getComputedStyle(h);
  
  const backLink = document.querySelector('a[aria-label="Back to course"]');
  const search = document.querySelector('[role="search"]');
  const tools = document.querySelector('[data-testid="theater-mode-toggle"]');
  const userMenu = document.querySelector('button[aria-label="User menu"]');
  
  const hr = h.getBoundingClientRect();
  
  return {
    headerHeight: Math.round(hr.height),
    headerMargin: cs.margin,
    headerPadding: cs.padding,
    headerGap: cs.gap,
    backLinkPosition: backLink ? { left: Math.round(backLink.getBoundingClientRect().left - hr.left) } : null,
    userMenuPosition: userMenu ? { right: Math.round(hr.right - userMenu.getBoundingClientRect().right) } : null,
    searchPosition: search ? { 
      left: Math.round(search.getBoundingClientRect().left - hr.left),
      center: Math.round(search.getBoundingClientRect().left + search.getBoundingClientRect().width / 2 - hr.left),
    } : null,
  };
});
console.log(JSON.stringify(spacing, null, 2));

await context.close();
await browser.close();
console.log('\n[DONE]');
