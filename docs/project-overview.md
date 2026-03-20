# LevelUp - Project Overview

> Generated: 2026-02-15 | Scan Level: Quick | Mode: Initial Scan

## Executive Summary

LevelUp is a personal learning platform built as a client-side React Single Page Application (SPA). It features progress tracking, study streaks, course management, and achievement analytics. Originally designed from Figma wireframes, the platform has evolved into a comprehensive learning dashboard with local-first data storage using IndexedDB.

The application serves as a personal course library manager where users can import course content from their local filesystem, watch video lessons, take notes, track study progress, and earn streak-based achievements.

## Project Identity

| Property | Value |
|----------|-------|
| **Name** | LevelUp (level-up) |
| **Version** | 0.0.1 |
| **Type** | Web Application (SPA) |
| **Architecture** | Monolith |
| **Primary Language** | TypeScript |
| **Framework** | React 18.3.1 + Vite 6.4.1 |
| **Design Origin** | [Figma E-learning Platform Wireframes](https://www.figma.com/design/q4x6ttJD11avObQNFoeQ2D/E-learning-platform-wireframes) |

## Technology Stack

### Core

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Language | TypeScript | 5.9.3 | Type-safe JavaScript |
| Framework | React | 18.3.1 | UI framework |
| Build Tool | Vite | 6.4.1 | Development server and bundler |
| Styling | Tailwind CSS | 4.1.12 | Utility-first CSS framework |
| Routing | React Router | 7.13.0 | Client-side routing |

### State & Data

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| State Management | Zustand | 5.0.11 | Lightweight global state |
| Client Database | Dexie | 4.3.0 | IndexedDB wrapper (local-first storage) |
| Forms | React Hook Form | 7.55.0 | Form state management |

### UI & Design

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| UI Primitives | shadcn/ui (Radix UI) | Various | 46 accessible component primitives |
| Icons | Lucide React | 0.487.0 | Icon library |
| Charts | Recharts | 2.15.4 | Data visualization |
| Animations | Motion (Framer) | 12.23.24 | Animation library |
| Date Utils | date-fns | 3.6.0 | Date formatting/manipulation |
| Toast | Sonner | 2.0.3 | Toast notifications |
| Carousel | Embla Carousel React | 8.6.0 | Carousel component |
| Drawer | Vaul | 1.1.2 | Drawer component |

### Content & AI

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| PDF Rendering | pdfjs-dist | 5.4.624 | PDF viewer |
| Markdown | React Markdown + remark-gfm | 10.1.0 | Markdown rendering |
| AI SDK | ai + @ai-sdk/anthropic + @ai-sdk/openai | Various | AI-powered learning features |

### Testing & Quality

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Unit Testing | Vitest | 4.0.18 | Unit and integration tests |
| E2E Testing | Playwright | 1.58.2 | End-to-end browser testing |
| Visual Testing | Storybook | 10.2.8 | Component documentation and visual tests |
| API Mocking | MSW | 2.12.10 | Mock Service Worker |
| Accessibility | @axe-core/playwright | 4.11.1 | Automated a11y testing |
| Performance | Lighthouse CI | 0.15.1 | Performance auditing |
| Linting | ESLint | 9.39.2 | Code quality |
| Formatting | Prettier | 3.8.1 | Code formatting |
| Coverage | @vitest/coverage-v8 | 4.0.18 | Test coverage |

### Infrastructure

| Category | Technology | Purpose |
|----------|-----------|---------|
| Containerization | Docker (multi-stage) | Prod, dev, and preview Dockerfiles |
| CI/CD | GitHub Actions | 3 workflows (CI, test, design review) |
| Web Server | Nginx | Production serving |

## Architecture Pattern

**Component-Based SPA with Local-First Storage**

- **Frontend-only architecture** - no backend server required for core functionality
- **Local-first data** - all user data stored in IndexedDB via Dexie
- **Client-side routing** - React Router v7 with nested routes
- **Component hierarchy** - shadcn/ui primitives composited into custom Figma components and page layouts
- **State management** - Zustand stores for cross-component state
- **Media serving** - Custom Vite plugin serves local course files during development
- **Mock API** - Mockoon-based mock backend for API development/testing

## Key Pages

| Page | Route | Purpose |
|------|-------|---------|
| Overview | `/` | Dashboard with stats, progress, recent activity |
| My Class | `/my-class` | Active courses and assignments |
| Courses | `/courses` | Course library and import |
| Course Detail | `/courses/:id` | Individual course view with lessons |
| Lesson Player | `/courses/:id/lessons/:lessonId` | Video player, PDF viewer, note-taking |
| Library | `/library` | Personal course library |
| Instructors | `/instructors` | Instructor directory |
| Reports | `/reports` | Analytics and progress reports |
| Settings | `/settings` | App configuration and AI provider settings |

## Development Status

- **Current Phase**: Implementation (Epic 1 in-progress, story 1-1 complete)
- **Total Epics**: 8 (Course Import, Video Playback, Notes, Progress, Streaks, Intelligence, Analytics, AI Assistant)
- **Sprint Tracking**: File-based (sprint-status.yaml)

## Related Documentation

- [Architecture](./planning-artifacts/architecture.md) - Detailed architecture decisions
- [PRD](./planning-artifacts/prd.md) - Product Requirements Document
- [Epics & Stories](./planning-artifacts/epics.md) - Implementation backlog
- [UX Design Spec](./planning-artifacts/ux-design-specification.md) - Design specification
- [Source Tree Analysis](./source-tree-analysis.md) - Annotated directory structure
- [Component Inventory](./component-inventory.md) - UI component catalog
- [Development Guide](./development-guide.md) - Setup and development instructions
- [Deployment Guide](./deployment-guide.md) - Docker and deployment configuration
