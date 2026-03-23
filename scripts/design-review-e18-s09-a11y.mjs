import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Scroll to quiz section
const quiz = page.locator('[data-testid="quiz-preferences-section"]');
await quiz.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);

// ─── 1. ARIA snapshot of quiz section ───────────────────────────────────────
const ariaSnapshot = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="quiz-preferences-section"]');
  if (!card) return null;

  function walk(el, depth = 0) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const ariaLabel = el.getAttribute('aria-label');
    const ariaHidden = el.getAttribute('aria-hidden');
    const id = el.id;
    const forAttr = el.getAttribute('for');
    const text = el.childElementCount === 0 ? el.textContent?.trim().slice(0, 60) : null;
    if (ariaHidden === 'true') return null;
    const info = { tag, role, ariaLabel, id, forAttr, text, depth };
    return info;
  }

  const all = [...card.querySelectorAll('*')].map(el => walk(el)).filter(Boolean);
  return all;
});

// Focus specifically on form elements
const formElements = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="quiz-preferences-section"]');
  const labels = [...(card?.querySelectorAll('label') ?? [])].map(l => ({
    tag: 'label',
    for: l.getAttribute('for'),
    htmlFor: l.htmlFor,
    text: l.textContent?.trim().slice(0, 60),
  }));
  const inputs = [...(card?.querySelectorAll('input, button, [role="radio"], [role="switch"]') ?? [])].map(el => ({
    tag: el.tagName.toLowerCase(),
    id: el.id,
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaChecked: el.getAttribute('aria-checked'),
    ariaLabelledby: el.getAttribute('aria-labelledby'),
    name: el.getAttribute('name'),
    type: el.getAttribute('type'),
    value: el.getAttribute('value'),
  }));
  return { labels, inputs };
});

console.log('Form elements:', JSON.stringify(formElements, null, 2));

// ─── 2. CONTRAST: check text colors in quiz section ─────────────────────────
const contrastData = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="quiz-preferences-section"]');
  if (!card) return [];

  const results = [];

  // Card header description text
  const desc = card.querySelector('p.text-sm.text-muted-foreground');
  if (desc) {
    const s = getComputedStyle(desc);
    results.push({ label: 'header description', color: s.color, bg: getComputedStyle(desc.closest('[class*="CardHeader"]') ?? card).backgroundColor });
  }

  // Label text (timer accommodation)
  const labels = [...card.querySelectorAll('label:not([for])')];
  labels.forEach((l, i) => {
    const s = getComputedStyle(l);
    results.push({ label: `timer card label ${i}`, color: s.color, bg: s.backgroundColor });
  });

  // Description text in timer cards
  const timerDescs = [...card.querySelectorAll('.text-xs.text-muted-foreground')];
  timerDescs.forEach((el, i) => {
    const s = getComputedStyle(el);
    // Find the nearest bg
    let bg = 'transparent';
    let parent = el.parentElement;
    while (parent && bg === 'transparent') {
      const pbg = getComputedStyle(parent).backgroundColor;
      if (pbg !== 'rgba(0, 0, 0, 0)' && pbg !== 'transparent') bg = pbg;
      parent = parent.parentElement;
    }
    results.push({ label: `muted text ${i}`, color: s.color, bg });
  });

  // Toggle labels
  const switchLabels = [...card.querySelectorAll('label[for]')];
  switchLabels.forEach(l => {
    const s = getComputedStyle(l);
    results.push({ label: `switch label "${l.textContent?.trim().slice(0,30)}"`, color: s.color, bg: getComputedStyle(card).backgroundColor });
  });

  return results;
});

console.log('Contrast data:', JSON.stringify(contrastData, null, 2));

// ─── 3. SELECTED TIMER: visual diff check ───────────────────────────────────
const selectedVsUnselected = await page.evaluate(() => {
  const selected = document.querySelector('[data-testid="timer-option-standard"]');
  const unselected = document.querySelector('[data-testid="timer-option-150%"]');
  if (!selected || !unselected) return null;
  const ss = getComputedStyle(selected);
  const us = getComputedStyle(unselected);
  return {
    selected: { bg: ss.backgroundColor, border: ss.borderColor, borderWidth: ss.borderWidth },
    unselected: { bg: us.backgroundColor, border: us.borderColor, borderWidth: us.borderWidth },
  };
});
console.log('Selected vs Unselected timer:', JSON.stringify(selectedVsUnselected, null, 2));

// ─── 4. CHECK: RadioGroupItem has sr-only — is it truly accessible? ─────────
const radioAccessibility = await page.evaluate(() => {
  // Check if the native radio inputs are truly hidden from AT
  const radios = [...document.querySelectorAll('[data-testid="timer-accommodation-group"] input[type="radio"]')];
  return radios.map(r => ({
    value: r.value,
    id: r.id,
    className: r.className,
    tabIndex: r.tabIndex,
    ariaChecked: r.getAttribute('aria-checked'),
    // Check parent label has text
    parentLabelText: r.closest('label')?.textContent?.trim().slice(0, 60),
  }));
});
console.log('Radio accessibility:', JSON.stringify(radioAccessibility, null, 2));

// ─── 5. SELECTED INDICATOR: visual only vs accessible? ─────────────────────
// The timer cards use only border/bg to show selected state — no text indicator
const selectedIndicators = await page.evaluate(() => {
  const options = ['standard', '150%', '200%'];
  return options.map(v => {
    const el = document.querySelector(`[data-testid="timer-option-${v}"]`);
    // Check if there's any visual selected indicator beyond color
    const hasCheckmark = el?.querySelector('[aria-label*="selected"]') !== null;
    const hasDot = el?.querySelector('.bg-brand.rounded-full') !== null;
    const radioInput = el?.querySelector('input[type="radio"]');
    return {
      value: v,
      hasCheckmark,
      hasDot,
      radioChecked: radioInput?.checked,
      radioValue: radioInput?.value,
    };
  });
});
console.log('Selected indicators:', JSON.stringify(selectedIndicators, null, 2));

// ─── 6. SWITCH HEIGHT CHECK ──────────────────────────────────────────────────
const switchDimensions = await page.evaluate(() => {
  const switches = [...document.querySelectorAll('[role="switch"]')];
  return switches.map(sw => {
    const r = sw.getBoundingClientRect();
    const s = getComputedStyle(sw);
    return {
      id: sw.id,
      renderedWidth: Math.round(r.width),
      renderedHeight: Math.round(r.height),
      // Check parent row height (44px min)
      parentHeight: Math.round(sw.closest('[class*="min-h"]')?.getBoundingClientRect().height ?? 0),
    };
  });
});
console.log('Switch dimensions:', JSON.stringify(switchDimensions, null, 2));

await browser.close();
