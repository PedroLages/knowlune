# LevelUp - Project Documentation Index

> Generated: 2026-02-15 | Mode: Initial Scan (Quick) | v1.2.0

## Project Overview

- **Type:** Web Application (Monolith SPA)
- **Primary Language:** TypeScript
- **Architecture:** Component-based SPA with local-first storage (IndexedDB)
- **Framework:** React 18.3.1 + Vite 6.4.1

## Quick Reference

- **Tech Stack:** React + TypeScript + Tailwind CSS v4 + Zustand + Dexie (IndexedDB) + shadcn/ui
- **Entry Point:** `src/main.tsx` → `src/app/App.tsx` → `src/app/routes.tsx`
- **Architecture Pattern:** Client-side SPA, local-first data, component-based UI
- **Design Origin:** [Figma E-learning Platform Wireframes](https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes)
- **Dev Server:** `npm run dev` → http://localhost:5173
- **Build:** `npm run build` → `dist/`

## Generated Documentation

- [Project Overview](./project-overview.md) - Executive summary, tech stack, architecture
- [Source Tree Analysis](./source-tree-analysis.md) - Annotated directory structure with all critical folders
- [Component Inventory](./component-inventory.md) - Full UI component catalog (46 shadcn/ui + 11 Figma + 14 app)
- [Development Guide](./development-guide.md) - Setup, scripts, testing, conventions
- [Deployment Guide](./deployment-guide.md) - Docker, CI/CD, production deployment

## Planning Artifacts

- [Product Requirements Document (PRD)](./planning-artifacts/prd.md) - Complete product requirements
- [Architecture](./planning-artifacts/architecture.md) - Architecture decisions and design
- [Epics & Stories](./planning-artifacts/epics.md) - Implementation backlog (8 epics, 43 stories)
- [UX Design Specification](./planning-artifacts/ux-design-specification.md) - UX patterns and design spec
- [Implementation Readiness Report](./planning-artifacts/implementation-readiness-report-2026-02-15.md) - Pre-implementation validation
- [Epic 4 Review](./planning-artifacts/epic-4-review-2026-02-14.md) - Epic 4 adversarial review
- [Epic 5 Review](./planning-artifacts/epic-5-review-2026-02-14.md) - Epic 5 adversarial review

## Implementation Artifacts

- [Sprint Status](./implementation-artifacts/sprint-status.yaml) - Current sprint tracking (Epic 1 in-progress)
- [Story 1-1: Data Foundation & Course Import](./implementation-artifacts/1-1-set-up-data-foundation-and-import-course-folder.md) - Completed story

## CI/CD & DevOps Documentation

- [CI Pipeline](./CI_PIPELINE.md) - CI pipeline architecture
- [CI Quick Reference](./CI_QUICK_REFERENCE.md) - Quick reference for CI commands
- [CI Examples](./CI_EXAMPLES.md) - CI usage examples
- [CI Secrets Checklist](./ci-secrets-checklist.md) - Security checklist
- [CI Configuration](./ci.md) - CI configuration details
- [Lighthouse CI](./lighthouse-ci.md) - Performance monitoring setup

## API & Mock Documentation

- [Mock API Guide](./MOCK_API_GUIDE.md) - Mockoon mock API setup
- [CURL Commands](./CURL_COMMANDS.md) - API testing curl commands

## Analysis & Research

- [Brainstorming Session](./analysis/brainstorming-session-2026-02-14.md) - Feature brainstorming
- [Phase 5 Summary](./PHASE_5_SUMMARY.md) - Phase 5 completion summary
- [Test Review](./test-review.md) - Test quality review

## Root-Level Reference Docs

- [README](../README.md) - Project README
- [CLAUDE.md](../CLAUDE.md) - Claude Code development instructions
- [Docker Guide](../DOCKER.md) - Full Docker documentation
- [Docker Quickstart](../DOCKER_QUICKSTART.md) - Docker quick start
- [Quickstart API](../QUICKSTART_API.md) - Mock API quickstart
- [Integration Strategy](../INTEGRATION_STRATEGY.md) - Integration approach
- [Attributions](../ATTRIBUTIONS.md) - Image credits

## Design System Reference

- [Design Principles](../.claude/workflows/design-review/design-principles.md) - Core design standards
- [Design Review Agent Config](../.claude/workflows/design-review/agent-config.md) - Automated review config

## Getting Started

1. **Install dependencies:** `npm install`
2. **Start development:** `npm run dev` → http://localhost:5173
3. **Run tests:** `npm test` (unit) or `npm run test:e2e` (E2E)
4. **Start Storybook:** `npm run storybook` → http://localhost:6006
5. **Build for production:** `npm run build` → `dist/`

For AI-assisted development, start with:
- **Understanding the app:** Read [Project Overview](./project-overview.md) and [Source Tree](./source-tree-analysis.md)
- **Building features:** Read [Architecture](./planning-artifacts/architecture.md) and [Epics](./planning-artifacts/epics.md)
- **Working on UI:** Read [Component Inventory](./component-inventory.md) and [Design Principles](../.claude/workflows/design-review/design-principles.md)
