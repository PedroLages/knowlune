const { chromium } = require('@playwright/test');

async function collectMetrics(route, iterations = 3) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  
  const metrics = [];
  
  // Warm-up run (discarded)
  console.log(`Warm-up run for ${route}...`);
  await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Measurement runs
  for (let i = 0; i < iterations; i++) {
    console.log(`Measurement ${i + 1}/${iterations} for ${route}...`);
    
    // Navigate to route
    await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle' });
    
    // Wait for page stability
    await page.waitForTimeout(2000);
    
    // Collect metrics
    const metric = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      const resources = performance.getEntriesByType('resource');

      // LCP (Largest Contentful Paint)
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries.length > 0 ? Math.round(lcpEntries[lcpEntries.length - 1].startTime) : null;

      // CLS (Cumulative Layout Shift)
      const layoutShifts = performance.getEntriesByType('layout-shift');
      const cls = layoutShifts
        .filter(entry => !entry.hadRecentInput)
        .reduce((sum, entry) => sum + entry.value, 0);

      // TBT (Total Blocking Time)
      const longTasks = performance.getEntriesByType('longtask');
      const tbt = longTasks.reduce((sum, task) => sum + Math.max(0, task.duration - 50), 0);

      const totalTransfer = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
      const jsResources = resources.filter(r => r.name.endsWith('.js') || r.initiatorType === 'script');
      const cssResources = resources.filter(r => r.name.endsWith('.css') || r.initiatorType === 'css');

      return {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        dom_interactive: Math.round(nav.domInteractive - nav.startTime),
        dom_complete: Math.round(nav.domComplete - nav.startTime),
        load_complete: Math.round(nav.loadEventEnd - nav.startTime),
        fcp: fcp ? Math.round(fcp.startTime) : null,
        lcp: lcp,
        cls: Math.round(cls * 1000) / 1000,
        tbt: Math.round(tbt),
        resource_count: resources.length,
        js_resource_count: jsResources.length,
        css_resource_count: cssResources.length,
        total_transfer_bytes: totalTransfer,
        largest_resources: resources
          .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
          .slice(0, 5)
          .map(r => ({
            name: r.name.split('/').pop(),
            size: r.transferSize,
            duration: Math.round(r.duration)
          }))
      };
    });
    
    metrics.push(metric);
    
    // Small pause between measurements
    await page.waitForTimeout(1000);
  }
  
  await browser.close();
  
  // Calculate medians
  const median = (arr) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  
  return {
    ttfb: Math.round(median(metrics.map(m => m.ttfb))),
    dom_interactive: Math.round(median(metrics.map(m => m.dom_interactive))),
    dom_complete: Math.round(median(metrics.map(m => m.dom_complete))),
    load_complete: Math.round(median(metrics.map(m => m.load_complete))),
    fcp: Math.round(median(metrics.map(m => m.fcp))),
    lcp: metrics[Math.floor(metrics.length / 2)].lcp,
    cls: metrics[Math.floor(metrics.length / 2)].cls,
    tbt: Math.round(median(metrics.map(m => m.tbt))),
    resource_count: Math.round(median(metrics.map(m => m.resource_count))),
    js_resource_count: Math.round(median(metrics.map(m => m.js_resource_count))),
    css_resource_count: Math.round(median(metrics.map(m => m.css_resource_count))),
    total_transfer_bytes: Math.round(median(metrics.map(m => m.total_transfer_bytes))),
    largest_resources: metrics[Math.floor(metrics.length / 2)].largest_resources,
    samples: iterations
  };
}

// Get route from command line
const route = process.argv[2] || '/';
collectMetrics(route).then(metrics => {
  console.log(JSON.stringify(metrics, null, 2));
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
