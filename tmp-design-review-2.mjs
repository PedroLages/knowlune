import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:5173';
const SCREENSHOTS = '/tmp/design-review-screenshots';
mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('console', msg => {
  if (msg.type() === 'error') console.log('[CERR] ' + msg.text());
});

// === Set up proper guest session and seed course data ===
await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// Set up guest mode through sessionStorage (matching the E2E fixture pattern)
await page.evaluate(() => {
  sessionStorage.setItem('_knowluneE2eBrowserInit', 'true');
  sessionStorage.setItem('knowlune-guest-mode', 'true');
  sessionStorage.setItem('knowlune-guest-user-id', 'guest-e2e-review');
});

// Navigate to library
await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Check what's on the page
const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
console.log('[PAGE-TEXT] Library first 500 chars: ' + pageText.slice(0, 500));

// Check current URL - maybe being redirected
const currentUrl = page.url();
console.log('[URL] Current: ' + currentUrl);

// Check for header
const hasHeader = await page.evaluate(() => {
  const h = document.querySelector('header');
  if (!h) return { found: false };
  const role = h.getAttribute('role');
  const cs = getComputedStyle(h);
  return {
    found: true,
    role: role,
    borderBottom: cs.borderBottom,
    display: cs.display,
    height: cs.height,
  };
});
console.log('[HEADER] ' + JSON.stringify(hasHeader));

// Check if there's a loading state or error
const bodyText = await page.evaluate(() => document.body.innerText);
console.log('[BODY-LENGTH] ' + bodyText.length + ' chars');

// Screenshot
await page.screenshot({ path: SCREENSHOTS + '/00-library-debug.png', fullPage: true });
console.log('[SCREENSHOT] Library page saved');

// Try direct route to a knowlune lesson URL
// Based on routes.tsx, lessons are at /courses/:courseId/lessons/:lessonId
// Let me check if there's a CourseDetail page that shows lesson links
await page.goto(BASE + '/courses', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const coursesText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('[COURSES-PAGE] ' + coursesText.slice(0, 300));
await page.screenshot({ path: SCREENSHOTS + '/00-courses-debug.png', fullPage: true });

// Also try: my-class
await page.goto(BASE + '/my-class', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
const mcText = await page.evaluate(() => document.body.innerText.slice(0, 500));
console.log('[MY-CLASS] ' + mcText.slice(0, 300));

// Check if there's an import button or way to add courses
// Try seeding a course via localStorage
// Check what localStorage keys exist
const lsKeys = await page.evaluate(() => {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    keys.push(localStorage.key(i));
  }
  return keys;
});
console.log('[LOCALSTORAGE] Keys: ' + JSON.stringify(lsKeys));

await context.close();
await browser.close();
console.log('[DONE]');
