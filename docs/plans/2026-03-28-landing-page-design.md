# Knowlune Landing Page — Design Spec

## Context

Hybrid landing page: lead with product value, close with open-source credibility. Targets both learners ("finish what you start") and developers ("self-host, local-first"). Inspired by Linear, Raycast, Cal.com, and Arc landing page patterns.

## Visual Identity

| Token | Value |
|-------|-------|
| Brand | `#5e6ad2` → `#8b92ff` gradient |
| Dark sections | `#0a0b1a` → `#1a1535` |
| Warm sections | `#FAF5EE` / `#fef9f2` |
| Headlines | Space Grotesk, 700, -0.03em |
| Body | DM Sans, 400-500 |
| Max width | 1152px (`max-w-7xl`) |
| Cards | white bg, rounded-xl, sanctuary shadow |
| CTAs | rounded-full, brand fill or ghost |

## Narrative Flow

Dark (problem) → Warm (solution) → Dark (action)

## Sections

### 1. Hero (Dark)
- Two-line headline: "You have courses everywhere. / You finish none of them."
- Second line in brand gradient text
- Dual CTAs: "Try the Demo" (solid) + "Star on GitHub" (ghost)
- Floating dashboard screenshot with gradient glow behind it
- Dot grid background pattern, 4% noise overlay

### 2. Trust Strip (Dark)
- Local-first · Open Source · Zero tracking · Works offline · Stars count
- Single row, text-white/50, hover reveals color

### 3. How It Works (Warm)
- Dark-to-warm gradient transition
- Three cards: Import → Track → Master
- Giant faded step numbers (1, 2, 3) behind each card

### 4. Feature Bento Grid (Warm)
- 6-tile asymmetric grid
- Large: Dashboard overview, streak counter
- Medium: AI curricula, skill radar
- Screenshots + icons + hover lift effects

### 5. Differentiator (Warm)
- Three comparison cards: Course Platforms vs Notes Apps vs Knowlune
- Knowlune card elevated with brand border + "Recommended" badge
- Competitors dimmed at 60% opacity

### 6. Open Source (Brand tinted)
- "Your data. Your device. Your rules."
- Two-column: value props left, terminal mockup right
- Docker command with traffic light dots

### 7. CTA Footer (Dark)
- "Start finishing what you started."
- Dual CTAs mirroring hero
- Minimal footer links

## Stitch Reference

- Project: `projects/5027479163225638247`
- Screen ID: `a4fea90527c1402aa985902b3ea0352e`
- HTML: `docs/plans/2026-03-28-landing-page-design.html`

## Implementation Notes

- The Stitch HTML uses CDN Tailwind — implementation should use the project's Tailwind v4 setup
- Replace Material Symbols with Lucide icons (project standard)
- Replace Stitch-generated images with actual Knowlune screenshots
- Add scroll-triggered animations via Framer Motion (already in project)
- The nav should link to actual app routes or anchor sections
- GitHub stars count should pull live from GitHub API
