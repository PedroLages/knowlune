import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const result = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="quiz-preferences-section"]');
  if (!card) return 'not found';
  // The CardTitle text is "Quiz Preferences"
  const titleEl = [...card.querySelectorAll('*')].find(el => el.textContent?.trim() === 'Quiz Preferences' && !el.querySelector('*'));
  return {
    tag: titleEl?.tagName,
    parentTag: titleEl?.parentElement?.tagName,
    grandparentTag: titleEl?.parentElement?.parentElement?.tagName,
    class: titleEl?.className?.slice(0, 120),
  };
});
console.log('CardTitle actual element:', JSON.stringify(result, null, 2));

// Also check if the CardTitle uses a different element in Settings.tsx vs QuizPreferencesForm.tsx
// Settings.tsx uses h2 directly for Profile, and h2 for Appearance
// QuizPreferencesForm uses CardTitle (which renders as div) -- but DOM shows H3
// This suggests the heading wrapper context is providing the h3 via CSS content?
// Let's check: what wraps the text "Quiz Preferences"?
const fullChain = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="quiz-preferences-section"]');
  const titleEl = [...card.querySelectorAll('*')].find(el => el.textContent?.trim() === 'Quiz Preferences' && !el.querySelector('*'));
  
  const chain = [];
  let el = titleEl;
  let depth = 0;
  while (el && el !== card && depth < 10) {
    chain.push({ tag: el.tagName, class: el.className?.slice(0, 80) });
    el = el.parentElement;
    depth++;
  }
  return chain;
});
console.log('DOM chain from text to card:', JSON.stringify(fullChain, null, 2));

await browser.close();
