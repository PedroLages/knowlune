# Storybook Setup Guide

This project uses **Storybook 10.2.8** with Vite for component development and testing.

## Quick Start

### Local Development

```bash
# Start Storybook on port 6006
npm run storybook

# Build static Storybook for deployment
npm run build-storybook
```

### Docker Development

```bash
# Start Storybook in Docker (along with the dev server)
docker-compose -f docker-compose.dev.yml up storybook

# Start both dev server and Storybook
docker-compose -f docker-compose.dev.yml up

# Start only Storybook
docker-compose -f docker-compose.dev.yml up storybook --build
```

Access Storybook at: http://localhost:6006

## Features

### Installed Addons

- **@storybook/addon-a11y** - Accessibility testing and compliance checks
- **@storybook/addon-docs** - Auto-generated documentation from stories
- **@storybook/addon-vitest** - Integration with Vitest for component testing
- **@chromatic-com/storybook** - Visual regression testing support
- **@storybook/addon-onboarding** - Onboarding guide for new contributors

### Configuration

- **Tailwind CSS v4** - Fully integrated with theme tokens from `src/styles/theme.css`
- **TypeScript** - Full TypeScript support with prop type extraction
- **React Router** - Stories use `MemoryRouter` for components that depend on routing
- **Accessibility** - A11y addon configured to show violations as 'todo' items

## Story Files

Story files are located alongside their components in the `src/` directory:

```
src/
├── app/
│   ├── components/
│   │   ├── figma/
│   │   │   ├── CourseCard.tsx
│   │   │   ├── CourseCard.stories.tsx  ✓ Created
│   │   │   ├── VideoPlayer.tsx
│   │   │   └── VideoPlayer.stories.tsx ✓ Created
```

### Story Naming Convention

Stories follow the pattern: `ComponentName.stories.tsx`

### Story Structure

Each story file includes:

1. **Meta configuration** - Component metadata and parameters
2. **Multiple variants** - Different states and use cases
3. **Documentation** - JSDoc comments for autodocs
4. **ArgTypes** - Control definitions for interactive props
5. **Decorators** - Wrapper components (MemoryRouter, theme providers, etc.)

## Available Stories

### CourseCard Stories

- **Default** - Basic course card with no progress
- **InProgress** - Card showing 25% completion
- **NearCompletion** - Card showing 75% completion
- **Completed** - 100% completed course
- **NoCoverImage** - Fallback icon when no image available
- **Category Variants** - All 5 category styles (Behavioral Analysis, Influence & Authority, etc.)
- **LongContent** - Tests text truncation with long titles/descriptions
- **Difficulty Levels** - Beginner, Intermediate, Advanced variants
- **GridLayout** - Multiple cards in responsive grid

### VideoPlayer Stories

- **Default** - Basic video player
- **WithTitle** - Player with accessibility title
- **WithInitialPosition** - Resume from saved position
- **WithCaptions** - Subtitle/caption support
- **WithExternalSeek** - Interactive timestamp links
- **WithTimeTracking** - Progress tracking display
- **FullyFeatured** - All features enabled with keyboard shortcut guide
- **ResponsiveLayout** - Mobile, tablet, desktop viewports
- **DarkMode** - Dark theme variant
- **InLessonContext** - Embedded in lesson page layout

## Writing New Stories

### Basic Template

```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { YourComponent } from './YourComponent'

const meta = {
  title: 'Components/YourComponent',
  component: YourComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    propName: {
      control: 'text',
      description: 'Prop description',
    },
  },
} satisfies Meta<typeof YourComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    propName: 'value',
  },
}
```

### With Router Decorator

For components that use React Router (Link, useNavigate, etc.):

```typescript
import { MemoryRouter } from 'react-router'

const meta = {
  // ... other config
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}
```

### Interactive Stories with Hooks

```typescript
export const Interactive: Story = {
  render: (args) => {
    const [state, setState] = useState(initialValue)

    return (
      <div>
        <YourComponent {...args} value={state} onChange={setState} />
      </div>
    )
  },
}
```

## Accessibility Testing

The a11y addon automatically checks for:

- Color contrast ratios (WCAG AA/AAA)
- Proper ARIA labels and roles
- Keyboard accessibility
- Form label associations
- Heading hierarchy

Violations are shown in the "Accessibility" panel. Current config shows them as 'todo' items (warnings) rather than blocking errors.

### A11y Configuration

Located in `.storybook/preview.ts`:

```typescript
a11y: {
  test: 'todo', // 'todo' | 'error' | 'off'
  config: {
    rules: [
      {
        id: 'color-contrast',
        enabled: false, // Disabled for custom theme colors
      },
    ],
  },
}
```

## Theming

Stories inherit the project's Tailwind theme including:

- **Background**: `#FAF5EE` (warm off-white)
- **Primary**: `blue-600` for CTAs
- **Border Radius**: `rounded-3xl` for cards, `rounded-xl` for buttons
- **Spacing**: 8px grid system

Custom backgrounds available in toolbar:
- Light (`#FAF5EE`)
- Dark (`#1a1a1a`)
- White (`#ffffff`)

## Testing with Vitest

Stories can be tested with the Vitest integration:

```bash
# Run Vitest with Storybook stories as tests
npx vitest --project=storybook

# With coverage
npx vitest --project=storybook --coverage
```

## Docker Configuration

The Storybook service in `docker-compose.dev.yml`:

```yaml
storybook:
  build:
    context: .
    dockerfile: Dockerfile.dev
  container_name: levelup-storybook
  ports:
    - "6006:6006"
  volumes:
    - ./src:/app/src
    - ./.storybook:/app/.storybook
  environment:
    - NODE_ENV=development
    - CHOKIDAR_USEPOLLING=true  # Enables hot reload
  command: npm run storybook
```

## Best Practices

1. **One story file per component** - Keep stories next to their components
2. **Multiple variants** - Create stories for different states (loading, error, empty, etc.)
3. **Use argTypes** - Define controls for interactive prop manipulation
4. **Add documentation** - Use JSDoc comments for autodocs generation
5. **Test accessibility** - Check the A11y panel for all stories
6. **Responsive testing** - Use viewport addon to test different screen sizes
7. **Include context** - Use decorators to provide necessary context (Router, Theme, etc.)

## Troubleshooting

### Hot reload not working in Docker

Ensure `CHOKIDAR_USEPOLLING=true` is set in `docker-compose.dev.yml`

### TypeScript errors in stories

Run TypeScript check: `npm run typecheck`

### Missing styles

Verify `src/styles/index.css` is imported in `.storybook/preview.ts`

### Router errors

Add MemoryRouter decorator to stories that use React Router components

## Resources

- [Storybook Documentation](https://storybook.js.org/docs)
- [Storybook Addons](https://storybook.js.org/addons)
- [Writing Stories](https://storybook.js.org/docs/react/writing-stories/introduction)
- [A11y Addon](https://storybook.js.org/addons/@storybook/addon-a11y)
- [Vitest Integration](https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon)
