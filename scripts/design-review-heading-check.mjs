/* eslint-disable @typescript-eslint/no-unused-vars */
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Get all headings AND the quiz section title actual tag
const quizTitleInfo = await page.evaluate(() => {
  const card = document.querySelector('[data-testid="quiz-preferences-section"]');
  if (!card) return 'not found';
  
  // Find the title element
  const header = card.querySelector('[class*="CardHeader"]') ?? card.firstElementChild;
  const titleEl = card.querySelector('[class*="font-display"]');
  return {
    titleTag: titleEl?.tagName,
    titleClass: titleEl?.className?.slice(0, 100),
    titleText: titleEl?.textContent,
    // Check if section has aria-labelledby or aria-label
    cardRole: card.getAttribute('role'),
    cardAriaLabel: card.getAttribute('aria-label'),
    cardAriaLabelledby: card.getAttribute('aria-labelledby'),
  };
});
console.log('Quiz section title info:', JSON.stringify(quizTitleInfo, null, 2));

// Full heading hierarchy with actual tags
const allHeadings = await page.evaluate(() => {
  const quiz = document.querySelector('[data-testid="quiz-preferences-section"]');
  if (!quiz) return [];
  // Get everything with a heading-like role
  return [...quiz.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].map(el => ({
    tag: el.tagName,
    role: el.getAttribute('role'),
    ariaLevel: el.getAttribute('aria-level'),
    text: el.textContent?.trim().slice(0, 60),
  }));
});
console.log('Headings within quiz section:', JSON.stringify(allHeadings, null, 2));

// Also check the CardHeader region
const headerRegion = await page.evaluate(() => {
  const quiz = document.querySelector('[data-testid="quiz-preferences-section"]');
  const header = quiz?.firstElementChild;
  return {
    tag: header?.tagName,
    class: header?.className?.slice(0, 100),
    role: header?.getAttribute('role'),
  };
});
console.log('Card header region:', JSON.stringify(headerRegion, null, 2));

await browser.close();
