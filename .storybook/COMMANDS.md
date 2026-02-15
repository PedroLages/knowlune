# Storybook Commands Quick Reference

## Local Development

```bash
# Start Storybook (port 6006)
npm run storybook

# Build static Storybook
npm run build-storybook

# Run Storybook tests with Vitest
npx vitest --project=storybook

# Run with coverage
npx vitest --project=storybook --coverage
```

## Docker Commands

```bash
# Start all services (dev + storybook)
docker-compose -f docker-compose.dev.yml up

# Start only Storybook
docker-compose -f docker-compose.dev.yml up storybook

# Rebuild and start
docker-compose -f docker-compose.dev.yml up storybook --build

# Run in background
docker-compose -f docker-compose.dev.yml up -d storybook

# View logs
docker-compose -f docker-compose.dev.yml logs -f storybook

# Stop services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes
docker-compose -f docker-compose.dev.yml down -v
```

## Access Points

- **Storybook UI**: http://localhost:6006
- **Dev Server**: http://localhost:5173
- **Mock API**: http://localhost:3000

## Useful Shortcuts

Within Storybook UI:

- `Ctrl/Cmd + K` - Search stories
- `S` - Toggle sidebar
- `D` - Toggle dark mode
- `F` - Toggle fullscreen
- `A` - Toggle addons panel
- `/` - Focus search

## File Locations

```
.storybook/
├── main.ts           # Main configuration
├── preview.ts        # Global decorators and parameters
├── vitest.setup.ts   # Vitest integration setup
├── README.md         # Full documentation
└── COMMANDS.md       # This file

src/app/components/figma/
├── CourseCard.stories.tsx    # CourseCard component stories
└── VideoPlayer.stories.tsx   # VideoPlayer component stories
```

## Component Testing Workflow

1. **Start Storybook**: `npm run storybook`
2. **Navigate to component** in sidebar
3. **Use Controls panel** to modify props interactively
4. **Check Accessibility panel** for a11y violations
5. **Test responsive** using viewport toolbar
6. **Review Docs** tab for auto-generated documentation

## Creating New Stories

```bash
# 1. Create story file next to component
touch src/app/components/[folder]/ComponentName.stories.tsx

# 2. Add basic template (see .storybook/README.md)

# 3. Verify story appears in Storybook UI
npm run storybook
```

## Troubleshooting

```bash
# Clear Storybook cache
rm -rf node_modules/.cache/storybook

# Reinstall dependencies
npm install

# Check TypeScript errors
npm run typecheck

# Rebuild Docker image
docker-compose -f docker-compose.dev.yml build storybook
```

## CI/CD Integration

```bash
# Build static Storybook for deployment
npm run build-storybook

# Output directory: storybook-static/
# Deploy to any static hosting (Netlify, Vercel, GitHub Pages, etc.)
```

## Environment Variables

For Docker development, the following env vars are set:

```bash
NODE_ENV=development
CHOKIDAR_USEPOLLING=true  # Enables file watching in Docker
```

## Additional Resources

- Full documentation: `.storybook/README.md`
- Project documentation: `CLAUDE.md`
- Storybook docs: https://storybook.js.org/docs
