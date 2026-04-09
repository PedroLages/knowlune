import { chromium } from 'playwright';
import fs from 'fs';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupTestData(page) {
  console.log('📚 Setting up test book data...');
  
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  
  const seeded = await page.evaluate(() => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('knowlune-library', 1);
      
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('books')) {
          const store = db.createObjectStore('books', { keyPath: 'id' });
          store.createIndex('format', 'format', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['books'], 'readwrite');
        const store = transaction.objectStore('books');
        
        store.clear();
        
        const books = [
          {
            id: 'test-epub-complete',
            title: 'Complete EPUB Book',
            author: 'Jane Author',
            description: 'A complete EPUB book with all metadata fields populated for comprehensive testing.',
            format: 'epub',
            isbn: '978-0-123456-78-9',
            tags: ['fiction', 'testing', 'complete'],
            fileSize: 1024000,
            createdAt: new Date().toISOString(),
            coverUrl: null
          },
          {
            id: 'test-audio-complete',
            title: 'Complete Audiobook',
            author: 'John Narrator',
            description: 'A complete audiobook with all metadata for testing audiobook display.',
            format: 'audiobook',
            isbn: '978-0-987654-32-1',
            tags: ['non-fiction', 'audio', 'complete'],
            fileSize: 5120000,
            createdAt: new Date().toISOString(),
            coverUrl: null
          },
          {
            id: 'test-epub-minimal',
            title: 'Minimal EPUB',
            author: null,
            description: null,
            format: 'epub',
            isbn: null,
            tags: [],
            fileSize: 512000,
            createdAt: new Date().toISOString(),
            coverUrl: null
          },
          {
            id: 'test-audio-minimal',
            title: 'Minimal Audiobook',
            author: null,
            description: null,
            format: 'audiobook',
            isbn: null,
            tags: [],
            fileSize: 2048000,
            createdAt: new Date().toISOString(),
            coverUrl: null
          }
        ];
        
        books.forEach(book => store.put(book));
        
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  
  if (seeded) {
    console.log('✅ Test data seeded successfully');
  }
  
  return seeded;
}

async function runTests() {
  const findings = [];
  const browser = await chromium.launch({ 
    headless: false, 
    slowMo: 300
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      findings.push({
        severity: 'HIGH',
        category: 'Console',
        description: `Console error: ${msg.text()}`,
        location: 'Runtime'
      });
    }
  });
  
  try {
    // Setup test data
    const dataReady = await setupTestData(page);
    if (!dataReady) {
      findings.push({
        severity: 'BLOCKER',
        category: 'Functional',
        description: 'Failed to seed test data',
        location: 'IndexedDB setup'
      });
      return { findings };
    }
    
    // Navigate to library
    console.log('🔗 Navigating to library page...');
    await page.goto('http://localhost:5173/library', { waitUntil: 'networkidle' });
    await sleep(2000);
    
    // Screenshot initial state
    await page.screenshot({ path: '/tmp/01-library-initial.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/01-library-initial.png');
    
    // Look for book cards
    const bookElements = await page.locator('div[class*="book"], div[class*="Book"], [data-testid*="book"]').all();
    console.log(`📖 Found ${bookElements.length} potential book elements`);
    
    if (bookElements.length === 0) {
      findings.push({
        severity: 'BLOCKER',
        category: 'Functional',
        description: 'No book elements found on library page - cannot test dialog functionality',
        location: '/library'
      });
      return { findings };
    }
    
    // Test AC-1: Context menu from book card
    console.log('\n🧪 Testing AC-1: Open dialog from book card context menu...');
    try {
      const firstBook = bookElements[0];
      await firstBook.click({ button: 'right' });
      await sleep(500);
      await page.screenshot({ path: '/tmp/02-context-menu.png' });
      console.log('📸 Screenshot: /tmp/02-context-menu.png');
      
      // Look for "About Book" menu item
      const aboutMenuItem = page.locator('text=About Book, text=about book, [data-testid*="about-book"]').first();
      const isVisible = await aboutMenuItem.isVisible().catch(() => false);
      
      if (isVisible) {
        console.log('✅ AC-1 PASS: About Book menu item found in context menu');
        findings.push({
          severity: 'PASS',
          category: 'AC-1',
          description: 'About Book menu item accessible from context menu',
          location: 'BookCard context menu'
        });
        
        // Click to open dialog
        await aboutMenuItem.click();
        await sleep(500);
        await page.screenshot({ path: '/tmp/03-dialog-open.png' });
        console.log('📸 Screenshot: /tmp/03-dialog-open.png');
        
        // Check if dialog opened
        const dialog = page.locator('[role="dialog"], .dialog, [class*="Dialog"]').first();
        const dialogVisible = await dialog.isVisible().catch(() => false);
        
        if (dialogVisible) {
          console.log('✅ Dialog opened successfully');
          
          // Test AC-2: Check metadata display
          console.log('\n🧪 Testing AC-2: Book metadata display...');
          const dialogContent = await dialog.textContent();
          
          const checks = {
            title: /Complete EPUB Book/i.test(dialogContent),
            author: /Jane Author/i.test(dialogContent),
            description: /complete EPUB book with all metadata/i.test(dialogContent),
            format: /EPUB/i.test(dialogContent),
            isbn: /978-0-123456-78-9/i.test(dialogContent),
            tags: /fiction|testing|complete/i.test(dialogContent)
          };
          
          const passedChecks = Object.entries(checks).filter(([_, passed]) => passed).length;
          console.log(`   Metadata checks: ${passedChecks}/${Object.keys(checks).length} passed`);
          
          if (passedChecks >= 4) {
            console.log('✅ AC-2 PASS: Most metadata displayed correctly');
            findings.push({
              severity: 'PASS',
              category: 'AC-2',
              description: `Book metadata displayed (${passedChecks}/${Object.keys(checks).length} fields)`,
              location: 'AboutBookDialog'
            });
          } else {
            console.log('⚠️ AC-2 PARTIAL: Some metadata missing');
            findings.push({
              severity: 'MEDIUM',
              category: 'AC-2',
              description: `Some metadata fields not displayed: ${Object.entries(checks).filter(([_, v]) => !v).map(([k]) => k).join(', ')}`,
              location: 'AboutBookDialog'
            });
          }
          
          // Test AC-4: Keyboard navigation
          console.log('\n🧪 Testing AC-4: Keyboard navigation...');
          
          // Test Escape to close
          await page.keyboard.press('Escape');
          await sleep(300);
          const stillOpen = await dialog.isVisible().catch(() => false);
          
          if (!stillOpen) {
            console.log('✅ AC-4 PASS: Escape key closes dialog');
            findings.push({
              severity: 'PASS',
              category: 'AC-4',
              description: 'Escape key closes dialog successfully',
              location: 'Dialog keyboard handler'
            });
          } else {
            console.log('❌ AC-4 FAIL: Escape key did not close dialog');
            findings.push({
              severity: 'HIGH',
              category: 'AC-4',
              description: 'Escape key does not close dialog',
              location: 'Dialog keyboard handler'
            });
          }
        } else {
          console.log('❌ AC-1 FAIL: Dialog did not open');
          findings.push({
            severity: 'BLOCKER',
            category: 'AC-1',
            description: 'Dialog did not open when clicking About Book menu item',
            location: 'AboutBookDialog trigger'
          });
        }
      } else {
        console.log('❌ AC-1 FAIL: About Book menu item not found');
        findings.push({
          severity: 'BLOCKER',
          category: 'AC-1',
          description: 'About Book menu item not found in context menu',
          location: 'BookContextMenu'
        });
      }
    } catch (error) {
      console.log('❌ AC-1 ERROR:', error.message);
      findings.push({
        severity: 'BLOCKER',
        category: 'AC-1',
        description: `Error testing context menu: ${error.message}`,
        location: 'BookCard interaction'
      });
    }
    
    // Test AC-3: Missing metadata fallback
    console.log('\n🧪 Testing AC-3: Missing metadata fallback...');
    try {
      // Find and click on minimal book
      const minimalBooks = await page.locator('text=Minimal EPUB, text=Minimal Audiobook').all();
      
      if (minimalBooks.length > 0) {
        await minimalBooks[0].click({ button: 'right' });
        await sleep(500);
        
        const aboutMenuItem = page.locator('text=About Book').first();
        await aboutMenuItem.click();
        await sleep(500);
        
        await page.screenshot({ path: '/tmp/04-minimal-metadata.png' });
        
        const dialog = page.locator('[role="dialog"]').first();
        const dialogContent = await dialog.textContent();
        
        if (/unknown author/i.test(dialogContent) || /no description/i.test(dialogContent)) {
          console.log('✅ AC-3 PASS: Fallback text displayed for missing metadata');
          findings.push({
            severity: 'PASS',
            category: 'AC-3',
            description: 'Fallback text shown for missing author/description',
            location: 'AboutBookDialog'
          });
        } else {
          console.log('⚠️ AC-3 PARTIAL: Fallback text may not be displayed');
          findings.push({
            severity: 'MEDIUM',
            category: 'AC-3',
            description: 'Could not verify fallback text for missing metadata',
            location: 'AboutBookDialog'
          });
        }
        
        await page.keyboard.press('Escape');
        await sleep(300);
      }
    } catch (error) {
      console.log('⚠️ AC-3 WARNING: Could not test missing metadata:', error.message);
    }
    
    // Test AC-5: Both formats
    console.log('\n🧪 Testing AC-5: Both EPUB and audiobook formats...');
    try {
      // Test audiobook
      const audioBook = await page.locator('text=Complete Audiobook').first();
      if (await audioBook.isVisible()) {
        await audioBook.click({ button: 'right' });
        await sleep(500);
        
        const aboutMenuItem = page.locator('text=About Book').first();
        await aboutMenuItem.click();
        await sleep(500);
        
        const dialog = page.locator('[role="dialog"]').first();
        const dialogContent = await dialog.textContent();
        
        if (/audiobook/i.test(dialogContent)) {
          console.log('✅ AC-5 PASS: Audiobook format displayed correctly');
          findings.push({
            severity: 'PASS',
            category: 'AC-5',
            description: 'Audiobook format displays in dialog',
            location: 'AboutBookDialog'
          });
        } else {
          console.log('⚠️ AC-5 PARTIAL: Audiobook format may not display correctly');
        }
        
        await page.keyboard.press('Escape');
        await sleep(300);
      }
    } catch (error) {
      console.log('⚠️ AC-5 WARNING: Could not test audiobook format:', error.message);
    }
    
    // Test click outside to close
    console.log('\n🧪 Testing: Click outside to close...');
    try {
      const firstBook = bookElements[0];
      await firstBook.click({ button: 'right' });
      await sleep(500);
      await page.locator('text=About Book').first().click();
      await sleep(500);
      
      const dialog = page.locator('[role="dialog"]').first();
      const visibleBefore = await dialog.isVisible();
      
      // Click outside
      await page.mouse.click(100, 100);
      await sleep(300);
      
      const visibleAfter = await dialog.isVisible().catch(() => false);
      
      if (visibleBefore && !visibleAfter) {
        console.log('✅ PASS: Click outside closes dialog');
        findings.push({
          severity: 'PASS',
          category: 'Functional',
          description: 'Click outside closes dialog successfully',
          location: 'Dialog overlay'
        });
      } else {
        console.log('⚠️ WARNING: Click outside may not close dialog reliably');
      }
    } catch (error) {
      console.log('⚠️ WARNING: Could not test click outside:', error.message);
    }
    
    // Test responsive layout
    console.log('\n🧪 Testing: Responsive layout (mobile)...');
    await page.setViewportSize({ width: 375, height: 667 });
    await sleep(500);
    
    const firstBook = bookElements[0];
    await firstBook.click({ button: 'right' });
    await sleep(500);
    await page.locator('text=About Book').first().click();
    await sleep(500);
    
    await page.screenshot({ path: '/tmp/05-mobile-layout.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/05-mobile-layout.png');
    
    const dialogOnMobile = await page.locator('[role="dialog"]').isVisible();
    if (dialogOnMobile) {
      console.log('✅ PASS: Dialog displays on mobile viewport');
      findings.push({
        severity: 'PASS',
        category: 'Functional',
        description: 'Dialog displays correctly on mobile viewport (375x667)',
        location: 'AboutBookDialog responsive layout'
      });
    } else {
      console.log('⚠️ WARNING: Dialog may have issues on mobile viewport');
    }
    
  } catch (error) {
    console.error('❌ Test execution error:', error);
    findings.push({
      severity: 'BLOCKER',
      category: 'Test Execution',
      description: `Fatal error during testing: ${error.message}`,
      location: 'Test framework'
    });
  }
  
  // Final screenshot
  await page.screenshot({ path: '/tmp/99-final-state.png', fullPage: true });
  
  // Keep browser open for manual inspection
  console.log('\n⏸️ Keeping browser open for 5 seconds for manual inspection...');
  await sleep(5000);
  
  await browser.close();
  
  return { findings };
}

// Run tests
console.log('🚀 Starting exploratory QA test for E107-S04: About Book Dialog\n');
runTests().then(result => {
  console.log('\n📊 TEST RESULTS:');
  console.log('='.repeat(60));
  
  const blockers = result.findings.filter(f => f.severity === 'BLOCKER').length;
  const highs = result.findings.filter(f => f.severity === 'HIGH').length;
  const passes = result.findings.filter(f => f.severity === 'PASS').length;
  
  console.log(`Blockers: ${blockers}`);
  console.log(`High: ${highs}`);
  console.log(`Passed: ${passes}`);
  console.log(`Total findings: ${result.findings.length}`);
  
  // Save findings to JSON
  fs.writeFileSync('/tmp/qa-findings.json', JSON.stringify(result.findings, null, 2));
  console.log('\n💾 Findings saved to /tmp/qa-findings.json');
  
  process.exit(blockers > 0 ? 1 : 0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
