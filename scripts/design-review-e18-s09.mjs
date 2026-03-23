import { chromium } from '@playwright/test';

const browser = await chromium.launch();

// ─── DESKTOP (1440px) ───────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/dr-01-desktop-full.png', fullPage: true });

  // Scroll to quiz section
  const quiz = page.locator('[data-testid="quiz-preferences-section"]');
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/dr-02-desktop-quiz-section.png' });

  // Screenshot with standard timer option visible
  const standardOption = page.locator('[data-testid="timer-option-standard"]');
  const box = await standardOption.boundingBox();
  console.log('Standard timer option bounding box:', JSON.stringify(box));

  // Computed styles
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const cardStyles = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="quiz-preferences-section"]');
    if (!card) return null;
    const s = getComputedStyle(card);
    return { bg: s.backgroundColor, radius: s.borderRadius, boxShadow: s.boxShadow };
  });
  const selectedTimerStyles = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="timer-option-standard"]');
    if (!el) return null;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, borderColor: s.borderColor, radius: s.borderRadius };
  });
  const switchStyles = await page.evaluate(() => {
    const sw = document.querySelector('[data-testid="immediate-feedback-toggle"]');
    if (!sw) return null;
    const s = getComputedStyle(sw);
    return { width: s.width, height: s.height };
  });

  console.log('Body bg:', bodyBg);
  console.log('Card styles:', JSON.stringify(cardStyles));
  console.log('Selected timer styles:', JSON.stringify(selectedTimerStyles));
  console.log('Switch dimensions:', JSON.stringify(switchStyles));

  // Check horizontal overflow
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log('Desktop horizontal overflow:', overflow);

  // Heading hierarchy
  const headings = await page.evaluate(() => {
    return [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => ({
      tag: h.tagName.toLowerCase(),
      text: h.textContent?.trim().slice(0, 60),
    }));
  });
  console.log('Headings:', JSON.stringify(headings));

  // Check for aria labels on icon buttons
  const iconButtons = await page.evaluate(() => {
    return [...document.querySelectorAll('button')].map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      text: b.textContent?.trim().slice(0, 40),
    }));
  });
  console.log('Buttons:', JSON.stringify(iconButtons));

  await page.close();
}

// ─── HOVER STATE: hover over non-selected timer option ──────────────────────
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const quiz = page.locator('[data-testid="quiz-preferences-section"]');
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  // Hover the 1.5x option (not selected by default)
  await page.hover('[data-testid="timer-option-150%"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: '/tmp/dr-03-hover-timer.png' });
  console.log('Hover screenshot taken');
  await page.close();
}

// ─── CLICK TIMER OPTION: select 1.5x ────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const quiz = page.locator('[data-testid="quiz-preferences-section"]');
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  // Click the 1.5x option and capture toast
  await page.click('[data-testid="timer-option-150%"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/dr-04-timer-selected-toast.png' });
  console.log('Timer selection + toast screenshot taken');

  // Toggle immediate feedback
  await page.click('[data-testid="immediate-feedback-toggle"]');
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/dr-05-toggle-feedback.png' });
  console.log('Toggle feedback screenshot taken');

  await page.close();
}

// ─── TABLET (768px) ─────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/dr-06-tablet-full.png', fullPage: true });
  const quiz = page.locator('[data-testid="quiz-preferences-section"]');
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/dr-07-tablet-quiz.png' });
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log('Tablet horizontal overflow:', overflow);
  await page.close();
}

// ─── MOBILE (375px) ─────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/dr-08-mobile-full.png', fullPage: true });
  const quiz = page.locator('[data-testid="quiz-preferences-section"]');
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/dr-09-mobile-quiz.png' });

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  console.log('Mobile horizontal overflow:', overflow);

  // Touch target sizes
  const touchTargets = await page.evaluate(() => {
    const items = [
      { id: 'timer-option-standard', el: document.querySelector('[data-testid="timer-option-standard"]') },
      { id: 'immediate-feedback-toggle', el: document.querySelector('[data-testid="immediate-feedback-toggle"]') },
      { id: 'shuffle-questions-toggle', el: document.querySelector('[data-testid="shuffle-questions-toggle"]') },
    ];
    return items.map(({ id, el }) => {
      if (!el) return { id, error: 'not found' };
      const r = el.getBoundingClientRect();
      return { id, width: Math.round(r.width), height: Math.round(r.height) };
    });
  });
  console.log('Touch targets (mobile):', JSON.stringify(touchTargets));
  await page.close();
}

// ─── KEYBOARD NAV ────────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const quiz = page.locator('[data-testid="quiz-preferences-section"]');
  await quiz.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  // Tab several times to reach quiz section
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
  }
  await page.screenshot({ path: '/tmp/dr-10-keyboard-focus.png' });

  const focusedEl = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, id: el?.id, role: el?.getAttribute('role'), ariaLabel: el?.getAttribute('aria-label'), className: el?.className?.slice?.(0, 80) };
  });
  console.log('Focused element after 15 tabs:', JSON.stringify(focusedEl));

  await page.close();
}

// ─── CONSOLE ERRORS ──────────────────────────────────────────────────────────
{
  const page = await browser.newPage();
  const errors = [];
  const warnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log('Console errors:', JSON.stringify(errors));
  console.log('Console warnings:', JSON.stringify(warnings));
  await page.close();
}

await browser.close();
console.log('All screenshots complete.');
