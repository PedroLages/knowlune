#\!/usr/bin/env node

/**
 * Dynamically extract SMOKE_SPECS from playwright.config.ts
 * Outputs JSON array of spec paths to stdout
 *
 * Exit codes:
 *   0 - Success
 *   1 - Extraction failed or file not found
 */

const fs = require("fs");
const path = require("path");

// Parse command line arguments
let basePath = process.cwd();
const args = process.argv.slice(2);

for (const arg of args) {
  if (arg.startsWith("--base-path=")) {
    basePath = arg.substring("--base-path=".length);
  }
}

// Extract SMOKE_SPECS from playwright.config.ts
try {
  const configPath = path.join(basePath, "playwright.config.ts");
  const configContent = fs.readFileSync(configPath, "utf8");

  // Extract SMOKE_SPECS array using regex
  const match = configContent.match(/export const SMOKE_SPECS = \[(\s\S]*?)\]/)
  if (\!match || \!match[1]) {
    console.error("ERROR: Could not extract SMOKE_SPECS from playwright.config.ts");
    process.exit(1);
  }

  // Parse the array content
  const arrayContent = match[1];
  const specs = [];
  const lineRegex = /'([^']*\.spec\.ts)'/g;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(arrayContent)) \!==  null) {
    specs.push(lineMatch[1]);
  }

  if (specs.length === 0) {
    console.error("ERROR: No specs extracted from SMOKE_SPECS");
    process.exit(1);
  }

  // Output as JSON to stdout
  console.log(JSON.stringify(specs));
} catch (error) {
  console.error("ERROR:", error.message);
  process.exit(1);
}
