/**
 * Design Review: Course Card Refactor (Unified Visual Language)
 * Plan: docs/plans/2026-04-19-022-refactor-unified-course-card-visual-language-plan.md
 *
 * All ImportedCourseCard routes: /courses (grid), /my-class (progress)
 * Static CourseCard is deprecated (useCourseStore is no-op stub).
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { seedImportedCourses } from './support/helpers/indexeddb-seed';
import { createImportedCourse } from './support/fixtures/factories/imported-course-factory';

const SCREENSHOT_DIR = '/tmp/design-review-screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const axeSource = fs.readFileSync('/Volumes/SSD/Dev/Apps/Knowlune/node_modules/axe-core/axe.min.js', 'utf-8');

// Test courses for /courses page — mix of statuses to verify card height consistency
const COURSES_NOT_STARTED = [
  createImportedCourse({ id: 'dr-ns-1', name: 'Fundamentals of Persuasion', status: 'active', videoCount: 12, pdfCount: 3, tags: ['psychology'] }),
  createImportedCourse({ id: 'dr-ns-2', name: 'Advanced Negotiation Tactics', status: 'active', videoCount: 8, pdfCount: 1, tags: ['negotiation'] }),
];
const COURSES_ACTIVE = [
  createImportedCourse({ id: 'dr-a-1', name: 'Body Language Mastery', status: 'active', videoCount: 15, pdfCount: 4, tags: ['body-language'] }),
  createImportedCourse({ id: 'dr-a-2', name: 'Social Dynamics Explained', status: 'active', videoCount: 10, pdfCount: 2, tags: ['social'] }),
];
const COURSES_COMPLETED = [
  createImportedCourse({ id: 'dr-c-1', name: 'Influence & Authority Complete', status: 'completed', videoCount: 20, pdfCount: 5, tags: ['influence'] }),
];
const ALL_TEST_COURSES = [...COURSES_NOT_STARTED, ...COURSES_ACTIVE, ...COURSES_COMPLETED];

async function injectAxe(page: any) {
  await page.evaluate((src: string) => {
    if (!(window as any).axe) { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); }
  }, axeSource);
}
async function runAxe(page: any) {
  await injectAxe(page);
  return page.evaluate(async () => {
    const results = await (window as any).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    });
    return {
      violations: results.violations.map((v: any) => ({
        id: v.id, impact: v.impact, description: v.description,
        nodes: v.nodes.length, targets: v.nodes.slice(0, 3).map((n: any) => n.target[0])
      })),
      passes: results.passes.length, incomplete: results.incomplete.length
    };
  });
}

function dismissOnboarding() {
  return {
    'knowlune-sidebar-v1': 'false',
    'knowlune-onboarding-v1': JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z', skipped: true }),
    'knowlune-welcome-wizard-v1': JSON.stringify({ completedAt: '2026-01-01T00:00:00.000Z' }),
  };
}

test.use({ bypassCSP: true, baseURL: 'http://localhost:5200', actionTimeout: 20000, navigationTimeout: 30000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((data) => {
    for (const [k, v] of Object.entries(data)) { localStorage.setItem(k, v as string); }
  }, dismissOnboarding());
});

// ─── Helper: seed IDB then force a full page reload to flush Zustand store ────
async function seedAndGoto(page: any, courses: any[], path: string) {
  // Navigate to base first so localStorage and IDB are accessible
  await page.goto('/');
  await page.waitForSelector('main', { timeout: 10000 });
  await seedImportedCourses(page, courses);
  // Hard reload to the target page — forces Zustand store to re-init from IDB
  await page.goto(path, { waitUntil: 'networkidle' });
}

// ─── TEST 1: /courses — ImportedCourseCard grid (desktop 1440px) ──────────────
test('DR-1: /courses grid structure and card anatomy (1440px)', async ({ page }) => {
  const r: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(`${page.url()} | ${msg.text()}`); });

  await seedAndGoto(page, ALL_TEST_COURSES, '/courses');
  await page.waitForSelector('[data-testid="imported-course-card"]', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-courses-1440.png` });

  r.cards = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="imported-course-card"]'));
    return cards.map(c => ({
      height: Math.round(c.getBoundingClientRect().height),
      status: c.querySelector('[data-testid="status-badge"]')?.textContent?.trim() || 'unknown',
      tagName: c.tagName,
      // R1 check: frameless (no nested Card)
      hasNestedCard: !!c.querySelector('.bg-card'),
      // R1 check: cover-edge progress bar
      hasCoverProgressBar: Array.from(c.querySelectorAll('[class]')).some(el => {
        const cls = el.className;
        return typeof cls === 'string' && cls.includes('absolute') && cls.includes('bottom-0') && cls.includes('left-0');
      }),
      // R1 check: -translate-y-2 on cover hover
      hasCoverTranslate: Array.from(c.querySelectorAll('[class]')).some(el =>
        typeof el.className === 'string' && el.className.includes('-translate-y-2')
      ),
      // Old hover scale check (should be removed in refactored cards)
      hasOldHoverScale: c.className.includes('scale-[1.02]') || c.className.includes('hover:scale'),
      // R2 check: play overlay present (only for not-started)
      hasPlayBtn: !!c.querySelector('[data-testid="start-course-btn"]'),
      // R4: Imported date in body (should NOT be in body per plan)
      hasImportedDateInBody: (() => {
        const body = c.querySelector('.p-5');
        return !!body && body.innerHTML.includes('Imported');
      })(),
    }));
  });

  // R4: Card height variance
  r.heightVariance = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="imported-course-card"]'));
    const heights = cards.slice(0, 6).map(c => Math.round(c.getBoundingClientRect().height));
    return { heights, max: Math.max(...heights), min: Math.min(...heights), variance: Math.max(...heights) - Math.min(...heights) };
  });

  // R1: Card computed styles
  r.computedStyles = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="imported-course-card"]');
    if (!card) return null;
    const s = window.getComputedStyle(card);
    const coverEl = card.querySelector('[class*="h-44"], [class*="relative"]') as HTMLElement | null;
    const cs = coverEl ? window.getComputedStyle(coverEl) : null;
    return {
      cardBg: s.backgroundColor,
      cardBorderRadius: s.borderRadius,
      cardBoxShadow: s.boxShadow.substring(0, 200),
      cardTagName: card.tagName,
      cardClassName: card.className.substring(0, 400),
      coverBorderRadius: cs?.borderRadius,
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    };
  });

  // Info button token check
  r.infoBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button[aria-label="Course details"]')).slice(0, 3).map(b => ({
      className: b.className.substring(0, 200),
      bg: window.getComputedStyle(b).backgroundColor,
      hasBgBlack: b.className.includes('bg-black'),
    }));
  });

  // Camera overlay (thumbnail change button)
  r.cameraOverlay = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button[aria-label="Change thumbnail"]')).slice(0, 3).map(b => ({
      className: b.className.substring(0, 200),
      zIndex: window.getComputedStyle(b).zIndex,
    }));
  });

  // Status badge accessibility
  r.statusBadges = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="status-badge"]')).slice(0, 3).map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      tagName: b.tagName,
      w: Math.round(b.getBoundingClientRect().width),
      h: Math.round(b.getBoundingClientRect().height),
    }));
  });

  // Category color classes — flag if hardcoded Tailwind colors are used
  r.categoryColorClasses = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class]')).filter(el => {
      const cls = el.className;
      return typeof cls === 'string' && (
        cls.includes('emerald-') || cls.includes('amber-1') || cls.includes('red-1') ||
        cls.includes('purple-1') || cls.includes('green-1')
      );
    }).slice(0, 10).map(el => ({ tag: el.tagName, cls: el.className.substring(0, 200), text: el.textContent?.trim().substring(0, 50) }));
  });

  // Keyboard accessibility: tab to cards, check focus ring
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  r.keyboardFocus = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { noFocus: true };
    const s = window.getComputedStyle(el);
    return {
      tag: el.tagName, role: el.getAttribute('role'), ariaLabel: el.getAttribute('aria-label'),
      outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, outlineColor: s.outlineColor,
      hasVisibleFocusRing: s.outlineStyle !== 'none' && s.outlineWidth !== '0px',
    };
  });

  r.coursesAxe = await runAxe(page);
  r.consoleErrors = errors;
  fs.writeFileSync('/tmp/dr-part1.json', JSON.stringify(r, null, 2));
  expect(true).toBe(true);
});

// ─── TEST 2: /courses play overlay behavior ──────────────────────────────────
test('DR-2: play overlay anatomy on not-started cards', async ({ page }) => {
  const r: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1440, height: 900 });

  await seedAndGoto(page, ALL_TEST_COURSES, '/courses');
  await page.waitForSelector('[data-testid="imported-course-card"]', { timeout: 10000 });
  await page.waitForTimeout(1000);

  r.playOverlayCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="imported-course-card"]'));
    return cards.map(c => {
      const statusBadge = c.querySelector('[data-testid="status-badge"]');
      const playBtn = c.querySelector('[data-testid="start-course-btn"]');
      const statusText = statusBadge?.textContent?.trim() || 'unknown';
      return {
        statusText,
        hasPlayBtn: !!playBtn,
        playBtnTag: playBtn?.tagName,
        playBtnAriaLabel: playBtn?.getAttribute('aria-label'),
        playBtnClass: playBtn?.className?.substring(0, 200) || null,
        // Desktop: opacity-0 by default (hover reveals it)
        playBtnComputedOpacity: playBtn ? window.getComputedStyle(playBtn).opacity : null,
        // Is play in cover area or body?
        playInBody: playBtn ? !!playBtn.closest('.p-5') : false,
      };
    });
  });

  // Z-index checks for overlapping overlays (camera vs play vs status)
  r.zIndexCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="imported-course-card"]'));
    return cards.slice(0, 4).map(c => {
      const cameraBtn = c.querySelector('button[aria-label="Change thumbnail"]');
      const playBtn = c.querySelector('[data-testid="start-course-btn"]');
      const statusWrapper = c.querySelector('[data-testid="status-badge"]')?.parentElement;
      return {
        statusText: c.querySelector('[data-testid="status-badge"]')?.textContent?.trim(),
        cameraClass: cameraBtn?.className?.substring(0, 150) || 'absent',
        playClass: playBtn?.className?.substring(0, 150) || 'absent',
        statusWrapperClass: statusWrapper?.className?.substring(0, 100) || 'absent',
        cameraZ: cameraBtn ? window.getComputedStyle(cameraBtn).zIndex : 'absent',
        playZ: playBtn ? window.getComputedStyle(playBtn).zIndex : 'absent',
      };
    });
  });

  fs.writeFileSync('/tmp/dr-part2.json', JSON.stringify(r, null, 2));
  expect(true).toBe(true);
});

// ─── TEST 3: /my-class — progress variant (desktop 1440px) ──────────────────
test('DR-3: /my-class progress variant (1440px)', async ({ page }) => {
  const r: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1440, height: 900 });

  await seedAndGoto(page, ALL_TEST_COURSES, '/my-class');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-my-class-1440.png` });

  r.pageHTML = await page.evaluate(() => document.querySelector('main')?.innerHTML.substring(0, 500));
  r.myClassCards = await page.evaluate(() => {
    // My-class shows ImportedCourseCards filtered by status != not-started
    const importedCards = Array.from(document.querySelectorAll('[data-testid="imported-course-card"]'));
    const courseCards = Array.from(document.querySelectorAll('[data-testid^="course-card-"]'));
    return {
      importedCount: importedCards.length,
      courseCardCount: courseCards.length,
      importedHeights: importedCards.map(c => Math.round(c.getBoundingClientRect().height)),
      courseCardHeights: courseCards.map(c => Math.round(c.getBoundingClientRect().height)),
    };
  });

  r.myClassAxe = await runAxe(page);
  fs.writeFileSync('/tmp/dr-part3.json', JSON.stringify(r, null, 2));
  expect(true).toBe(true);
});

// ─── TEST 4: Authors + Library reference ─────────────────────────────────────
test('DR-4: authors profile and library BookCard reference (1440px)', async ({ page }) => {
  const r: Record<string, unknown> = {};
  await page.setViewportSize({ width: 1440, height: 900 });

  // Authors — uses IDB author data
  await seedAndGoto(page, ALL_TEST_COURSES, '/authors');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/03-authors-1440.png` });

  const authorLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]'))
      .filter((a: any) => /\/authors\/[^/]+$/.test(a.href) && a.href !== window.location.href)
      .slice(0, 3).map((a: any) => new URL(a.href).pathname);
  });
  r.authorLinks = authorLinks;

  if (authorLinks.length > 0) {
    await page.goto(authorLinks[0], { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-author-profile-1440.png` });
    r.authorProfileCards = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid^="course-card-"], [data-testid="imported-course-card"]'));
      return { count: cards.length, heights: cards.map(c => Math.round(c.getBoundingClientRect().height)) };
    });
  }

  // Library — BookCard DNA reference
  await page.goto('/library', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-library-1440.png` });

  r.bookCardDNA = await page.evaluate(() => {
    // BookCards are articles with group class
    const articles = Array.from(document.querySelectorAll('article'));
    return articles.slice(0, 5).map(g => ({
      tag: g.tagName,
      hasCoverTranslate: Array.from(g.querySelectorAll('[class]')).some(el =>
        typeof el.className === 'string' && el.className.includes('-translate-y')
      ),
      hasCoverProgressBar: Array.from(g.querySelectorAll('[class]')).some(el => {
        const cls = el.className;
        return typeof cls === 'string' && cls.includes('bottom-0') && cls.includes('absolute');
      }),
      hasNestedCard: !!g.querySelector('.bg-card'),
      hasFramelessStructure: !g.querySelector('.bg-card'),
      className: g.className.substring(0, 200),
    }));
  });

  fs.writeFileSync('/tmp/dr-part4.json', JSON.stringify(r, null, 2));
  expect(true).toBe(true);
});

// ─── TEST 5: Mobile 375px ────────────────────────────────────────────────────
test('DR-5: mobile 375px - overflow, touch targets, touch overlay', async ({ page }) => {
  const r: Record<string, unknown> = {};
  await page.setViewportSize({ width: 375, height: 812 });

  await seedAndGoto(page, ALL_TEST_COURSES, '/courses');
  await page.waitForSelector('[data-testid="imported-course-card"]', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/06-courses-375.png` });

  r.mobileOverflow = await page.evaluate(() => ({
    hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  r.mobileCardHeights = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="imported-course-card"]')).slice(0, 4)
      .map(c => Math.round(c.getBoundingClientRect().height));
  });

  // Touch targets: check all buttons on mobile
  r.smallTouchTargets = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, [role="button"]')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
    }).slice(0, 20).map(el => ({
      ariaLabel: el.getAttribute('aria-label'),
      text: el.textContent?.trim().substring(0, 40),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height),
    }));
  });

  // Touch overlay: on mobile (hover:none), play overlay should always be visible
  r.touchPlayOverlayVisibility = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="start-course-btn"]')).map(btn => {
      const s = window.getComputedStyle(btn);
      return {
        opacity: s.opacity,
        display: s.display,
        visibility: s.visibility,
        w: Math.round(btn.getBoundingClientRect().width),
        h: Math.round(btn.getBoundingClientRect().height),
      };
    });
  });

  // Horizontal scroll check
  r.mobileScrollWidth = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    hasScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-courses-375-detail.png` });

  fs.writeFileSync('/tmp/dr-part5.json', JSON.stringify(r, null, 2));
  expect(true).toBe(true);
});

// ─── TEST 6: Tablet 768px ────────────────────────────────────────────────────
test('DR-6: tablet 768px - layout grid and heights', async ({ page }) => {
  const r: Record<string, unknown> = {};
  await page.setViewportSize({ width: 768, height: 1024 });

  await seedAndGoto(page, ALL_TEST_COURSES, '/courses');
  await page.waitForSelector('[data-testid="imported-course-card"]', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-courses-768.png` });

  r.tabletOverflow = await page.evaluate(() => ({
    hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));

  r.tabletCardHeights = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-testid="imported-course-card"]')).slice(0, 6)
      .map(c => Math.round(c.getBoundingClientRect().height));
  });

  r.tabletHeightVariance = await page.evaluate(() => {
    const heights = Array.from(document.querySelectorAll('[data-testid="imported-course-card"]')).slice(0, 6)
      .map(c => Math.round(c.getBoundingClientRect().height));
    return { heights, max: Math.max(...heights), min: Math.min(...heights), variance: Math.max(...heights) - Math.min(...heights) };
  });

  fs.writeFileSync('/tmp/dr-part6.json', JSON.stringify(r, null, 2));
  expect(true).toBe(true);
});
