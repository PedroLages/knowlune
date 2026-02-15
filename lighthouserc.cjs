/* global module */
module.exports = {
  ci: {
    collect: {
      // URLs to test - using Vite preview server on port 4173
      url: [
        'http://localhost:4173/',                      // Overview page
        'http://localhost:4173/my-class',              // My Class page
        'http://localhost:4173/courses',               // Courses listing
        'http://localhost:4173/courses/1',             // Course Detail page
        'http://localhost:4173/courses/1/1',           // Lesson Player page
        'http://localhost:4173/library',               // Library page
        'http://localhost:4173/reports',               // Reports page
      ],
      // Run 3 tests per URL for consistency
      numberOfRuns: 3,
      settings: {
        // Chrome flags for headless testing
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        // Preset for performance testing
        preset: 'desktop',
        // Only run specific categories
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      // Performance assertions
      assertions: {
        // Overall category scores
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],

        // Core Web Vitals - Performance metrics
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 3000 }],

        // Resource optimization
        'unused-javascript': ['warn', { maxNumericValue: 100000 }],
        'unused-css-rules': ['warn', { maxNumericValue: 50000 }],
        'modern-image-formats': 'warn',
        'offscreen-images': 'warn',
        'uses-responsive-images': 'warn',
        'uses-optimized-images': 'warn',
        'uses-text-compression': 'warn',

        // Accessibility - Critical issues
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'button-name': 'error',
        'link-name': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        'document-title': 'error',

        // Best practices
        'errors-in-console': 'warn',
      },
    },
    upload: {
      // Upload to temporary public storage for viewing reports
      target: 'temporary-public-storage',
    },
  },
};
