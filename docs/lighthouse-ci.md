# Lighthouse CI Performance Monitoring

This document explains how to use Lighthouse CI for automated performance, accessibility, and SEO testing in the e-learning platform.

## Overview

Lighthouse CI is integrated into the project to provide automated performance monitoring and quality assurance. It tests the application against Google's Lighthouse metrics including:

- **Performance**: Core Web Vitals (LCP, CLS, TBT), page load times, resource optimization
- **Accessibility**: WCAG 2.1 AA+ compliance, color contrast, ARIA labels, keyboard navigation
- **Best Practices**: HTTPS usage, console errors, deprecated APIs
- **SEO**: Meta tags, structured data, mobile-friendliness

## Test Coverage

The following pages are automatically tested:

1. **Overview** (`/`) - Dashboard homepage
2. **My Class** (`/my-class`) - Student's enrolled courses
3. **Courses** (`/courses`) - Course catalog listing
4. **Course Detail** (`/courses/1`) - Individual course page
5. **Lesson Player** (`/courses/1/1`) - Video/content player
6. **Library** (`/library`) - Resource library
7. **Reports** (`/reports`) - Analytics dashboard

Each URL is tested **3 times** for consistency, and results are averaged.

## Prerequisites

- Node.js 20+ installed
- Application built (`npm run build`)
- Docker (optional, for containerized testing)

## Running Lighthouse CI

### Method 1: Local with npm scripts (Recommended for Development)

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the preview server** (in a separate terminal):
   ```bash
   npm run preview
   ```
   This starts a production server on `http://localhost:4173`

3. **Run Lighthouse CI** (in another terminal):
   ```bash
   npm run lighthouse
   ```

This will:
- Collect performance data from all test URLs (3 runs each)
- Assert against performance thresholds
- Upload results to temporary public storage
- Display links to view detailed HTML reports

### Method 2: Docker (Recommended for CI/CD)

Run the entire pipeline in containers:

```bash
npm run lighthouse:docker
```

This command:
1. Builds the application
2. Starts a preview server
3. Waits for the server to be healthy
4. Runs Lighthouse CI tests
5. Outputs results with report links

### Method 3: Individual Commands

For more control, run Lighthouse CI steps individually:

```bash
# 1. Build the app
npm run build

# 2. Start preview server (separate terminal)
npm run preview

# 3. Collect Lighthouse data only
npm run lighthouse:collect

# 4. Assert against thresholds
npm run lighthouse:assert

# 5. Upload results to view reports
npm run lighthouse:upload
```

## Performance Assertions

The configuration enforces the following quality standards:

### Category Scores (0-1 scale)
- **Performance**: ≥ 0.9 (error if below)
- **Accessibility**: ≥ 0.9 (error if below)
- **Best Practices**: ≥ 0.9 (warning if below)
- **SEO**: ≥ 0.9 (warning if below)

### Core Web Vitals
- **First Contentful Paint (FCP)**: ≤ 2.0s (warning)
- **Largest Contentful Paint (LCP)**: ≤ 2.5s (warning)
- **Cumulative Layout Shift (CLS)**: ≤ 0.1 (warning)
- **Total Blocking Time (TBT)**: ≤ 300ms (warning)
- **Speed Index**: ≤ 3.0s (warning)

### Resource Optimization
- **Unused JavaScript**: ≤ 100KB (warning)
- **Unused CSS**: ≤ 50KB (warning)
- Modern image formats required
- Text compression required
- Responsive images required

### Accessibility (WCAG 2.1 AA+)
- **Color contrast**: 4.5:1 minimum (error)
- **Image alt text**: Required (error)
- **Form labels**: Required (error)
- **Button names**: Required (error)
- **Link names**: Required (error)
- **HTML lang attribute**: Required (error)
- **Meta viewport**: Required (error)
- **Document title**: Required (error)

## Reading Results

After running Lighthouse CI, you'll see output like:

```
✅ Assertions passed for http://localhost:4173/
   - categories:performance: 0.95 (>= 0.9)
   - categories:accessibility: 0.98 (>= 0.9)
   - first-contentful-paint: 1.2s (<= 2.0s)
   - largest-contentful-paint: 1.8s (<= 2.5s)

📊 View detailed report:
   https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/...
```

### Report Links
- Click the provided URLs to view **interactive HTML reports**
- Reports include detailed breakdowns, screenshots, and recommendations
- Reports are stored for **7 days** on temporary public storage

### Common Issues

**Performance Issues:**
- Large JavaScript bundles (see bundle analyzer recommendations)
- Unoptimized images (convert to WebP/AVIF)
- Missing text compression
- Render-blocking resources

**Accessibility Issues:**
- Missing alt text on images
- Low color contrast ratios
- Missing form labels
- Non-keyboard navigable elements

**Best Practices:**
- Console errors or warnings
- Deprecated APIs
- Missing HTTPS (in production)

## Configuration

The Lighthouse CI configuration is in `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/lighthouserc.js`. Key settings:

```javascript
{
  collect: {
    url: [...],              // URLs to test
    numberOfRuns: 3,         // Runs per URL
    settings: {
      preset: 'desktop',     // Desktop configuration
      chromeFlags: '...',    // Chrome launch flags
    }
  },
  assert: {
    assertions: {...}        // Performance thresholds
  },
  upload: {
    target: 'temporary-public-storage'  // Report hosting
  }
}
```

### Customizing Tests

**Add new pages to test:**
```javascript
url: [
  'http://localhost:4173/',
  'http://localhost:4173/my-new-page',  // Add here
]
```

**Adjust performance thresholds:**
```javascript
assertions: {
  'first-contentful-paint': ['warn', { maxNumericValue: 1500 }],  // Stricter
}
```

**Test mobile performance:**
```javascript
settings: {
  preset: 'mobile',  // Change to mobile
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run Lighthouse CI
        run: |
          npm run build
          npm run preview &
          sleep 10
          npm run lighthouse
```

### Docker Compose (Already Configured)

The project includes `/Volumes/SSD/Dev/Apps/Elearningplatformwireframes/docker-compose.test.yml` for containerized testing:

```yaml
services:
  preview:    # Vite preview server
  lighthouse: # Lighthouse CI runner
```

Run with: `npm run lighthouse:docker`

## Troubleshooting

### Preview server not responding
```bash
# Check if port 4173 is in use
lsof -i :4173

# Kill existing process
kill -9 <PID>
```

### Lighthouse fails to connect
```bash
# Ensure preview server is running
curl http://localhost:4173

# Check firewall settings
# Try running with --help flag for debug info
npx lhci autorun --help
```

### Assertion failures
- Review the detailed HTML report (link in output)
- Check specific metrics that failed
- Use Chrome DevTools Lighthouse tab for local debugging
- Compare against previous runs to identify regressions

### Docker issues
```bash
# Check Docker is running
docker ps

# View container logs
docker-compose -f docker-compose.test.yml logs lighthouse

# Rebuild containers
docker-compose -f docker-compose.test.yml build --no-cache
```

## Best Practices

1. **Run before PRs**: Catch performance regressions early
2. **Monitor trends**: Track scores over time
3. **Fix blockers first**: Address error-level issues immediately
4. **Optimize images**: Use WebP/AVIF formats, lazy loading
5. **Code splitting**: Use dynamic imports for large dependencies
6. **Accessibility**: Test with keyboard navigation and screen readers
7. **Budget alerts**: Set up Slack/email notifications for CI failures

## Resources

- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring Guide](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Chrome DevTools Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/)

## Support

For issues with Lighthouse CI setup or results interpretation, contact the development team or file an issue in the project repository.
