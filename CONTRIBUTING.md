# Contributing to Knowlune

Thank you for your interest in contributing to Knowlune! We welcome contributions of all kinds — code, documentation, tests, translations, design feedback, and bug reports.

## Getting Started

### Prerequisites

- **Node.js** 18+ (we recommend the latest LTS)
- **npm** 9+
- **Git**

### Quick Start

```bash
git clone https://github.com/PedroLages/knowlune.git
cd eduvi
npm install
npm run dev
```

The dev server starts at [http://localhost:5173](http://localhost:5173).

### Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run test:unit` | Run unit tests |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run typecheck` | TypeScript type checking |
| `npm run ci` | Full CI pipeline (typecheck + lint + format + build + unit tests) |

## Project Structure

```
src/
├── app/
│   ├── components/     # Reusable UI components
│   │   ├── ui/         # shadcn/ui component library (~50 components)
│   │   └── figma/      # Custom components from the original design
│   └── pages/          # Route page components
├── lib/                # Utilities and services
├── stores/             # Zustand state management
├── db/                 # IndexedDB schema (Dexie.js)
└── styles/             # Tailwind CSS v4, theme tokens, fonts

tests/
├── e2e/                # Playwright E2E tests
└── support/            # Test fixtures, factories, helpers
```

## How to Contribute

### Finding Work

- Browse issues labeled [`good first issue`](https://github.com/PedroLages/knowlune/labels/good%20first%20issue) for beginner-friendly tasks
- Check [`help wanted`](https://github.com/PedroLages/knowlune/labels/help%20wanted) for tasks that need contributors
- Join [Discussions](https://github.com/PedroLages/knowlune/discussions) to propose ideas or ask questions

### Types of Contributions

- **Code**: Bug fixes, features, performance improvements
- **Tests**: Unit tests, E2E tests, edge case coverage
- **Documentation**: README improvements, inline docs, guides
- **Design**: UI/UX feedback, accessibility improvements, responsive fixes
- **Translations**: i18n support (infrastructure coming soon)
- **Bug Reports**: File detailed issues with reproduction steps

### Development Workflow

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/your-description`
3. **Make your changes** — keep commits focused and descriptive
4. **Run checks** before submitting: `npm run ci`
5. **Open a Pull Request** against `main`

### Branch Naming

Use descriptive, lowercase branch names with hyphens:
- `feature/add-keyboard-shortcuts`
- `fix/mobile-sidebar-overlap`
- `docs/update-setup-guide`

### Commit Messages

We use conventional-style commit messages:
- `feat: add dark mode toggle animation`
- `fix: resolve sidebar overflow on tablet`
- `docs: update API mock setup guide`
- `test: add unit tests for streak calculation`

## Code Standards

Knowlune uses **13 automated quality mechanisms** that enforce standards at save-time, commit-time, and review-time. This means:

- **You won't get style nits in review** — ESLint catches formatting and pattern issues automatically
- **Design tokens are enforced** — use `bg-brand` not `bg-blue-600` (the linter will tell you)
- **Test patterns are enforced** — deterministic time, no hard waits, seeding helpers

### Key Rules

- **Tailwind CSS v4** with design tokens from `src/styles/theme.css` — never hardcode colors
- **TypeScript strict mode** — no `any` types without justification
- **shadcn/ui components** — use existing components from `src/app/components/ui/` before building custom ones
- **Accessibility** — WCAG 2.1 AA minimum (4.5:1 contrast, keyboard navigation, ARIA labels)

## Pull Request Process

1. Fill out the PR template (summary, type of change, checklist)
2. Ensure `npm run ci` passes locally
3. Add screenshots for any UI changes
4. Link related issues

### What to Expect

- **Response time**: We aim to review PRs within 48 hours
- **Feedback**: Constructive, specific, and kind — we're here to help you succeed
- **Iteration**: Some PRs need revisions — that's normal and welcome

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold a welcoming, inclusive environment.

## License

By contributing to Knowlune, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE). This is an inbound=outbound model — no separate CLA is required.

## Questions?

- Open a [Discussion](https://github.com/PedroLages/knowlune/discussions) for general questions
- File an [Issue](https://github.com/PedroLages/knowlune/issues) for bugs or feature requests
- Check the [CLAUDE.md](CLAUDE.md) file for detailed architecture documentation
