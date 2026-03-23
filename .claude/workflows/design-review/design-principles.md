# E-Learning Platform Design Principles

## Core Philosophy

**Learning-First Design**: Every interface decision should reduce cognitive load and support focused learning. The platform prioritizes clarity, consistency, and accessibility to create an inclusive educational environment.

**Key Tenets:**
- **Clarity over Cleverness**: Straightforward interactions trump novel UI patterns
- **Consistency is Confidence**: Predictable patterns build user trust and reduce learning curves
- **Accessibility is Non-Negotiable**: WCAG 2.1 AA+ compliance minimum for educational equity
- **Performance = Pedagogy**: Fast interfaces keep learners engaged and focused

---

## Design System Foundations

### Color Architecture

**Primary Palette:**
- Background: `#FAF5EE` (warm off-white) - reduces eye strain for extended learning sessions
- Primary Blue: `blue-600` - for CTAs, active states, and interactive elements
- Semantic Colors:
  - Green: Course completion, success states
  - Red: Destructive actions, urgent notifications
  - Amber: Warnings, pending items
  - Blue: Informational messages, tips

**Accessibility Requirements:**
- All text must meet WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Dark mode support with verified contrast ratios
- Never use color as the sole indicator of information

### Typography Standards

**Font Stack:**
- Primary: System fonts for performance and native feel
- Hierarchy: Clear distinction between heading levels (H1-H4) and body text
- Line Height: 1.5-1.7 for optimal reading comprehension
- Font Weights: Regular, Medium, SemiBold, Bold (limited set for consistency)

**Readability Rules:**
- Line length: 50-75 characters for body text
- Sufficient spacing between paragraphs and sections
- Left-aligned text for LTR languages (never center-align body text)

### Spacing & Layout

**8px Base Grid:**
- All spacing uses multiples of 8px (0.5rem)
- Consistent 24px (1.5rem) margins between major sections
- Generous whitespace to prevent visual overwhelm

**Border Radius:**
- Cards: `rounded-[24px]` for softer, approachable feel
- Buttons: `rounded-xl` (12px) for clear clickability
- Inputs: `rounded-lg` (8px) for form consistency

---

## Component Design Standards

### Navigation Components

**Sidebar Navigation:**
- Always visible on desktop (≥1024px)
- Active state clearly indicated with background color + icon color change
- Icons + labels for clarity (never icon-only navigation)
- Logical grouping with visual separators

**Header:**
- Fixed position with search, notifications, and user profile
- Search bar prominently placed for quick course/content discovery
- Notification badge with count indicator
- User avatar with dropdown menu access

### Course Cards

**Essential Elements:**
- High-quality course thumbnail (consistent aspect ratio)
- Clear course title (readable at a glance)
- Instructor information with avatar
- Progress indicator (visual bar + percentage)
- Difficulty level badge
- Category/topic tag

**Interaction States:**
- Hover: Subtle elevation with shadow
- Active: Slight scale or border highlight
- Focus: Clear outline for keyboard navigation

### Data Display

**Tables:**
- Left-align text, right-align numbers
- Bold headers with clear visual separation
- Sortable columns with visual indicators
- Row hover states for scannability
- Pagination for datasets >20 rows

**Progress Indicators:**
- Always show percentage or fraction (e.g., "4/12 lessons completed")
- Visual progress bar with smooth animations
- Color-coded by status (in-progress blue, completed green)

### Forms & Inputs

**Input Fields:**
- Clear labels above inputs
- Placeholder text for examples only (never as labels)
- Validation feedback inline and real-time
- Error states with specific, actionable messages
- Success states with confirmation

**Buttons:**
- Primary: Blue-600 background for main actions
- Secondary: Outlined or ghost style for alternative actions
- Destructive: Red for delete/remove operations
- Disabled: Reduced opacity + cursor not-allowed

---

## Interaction & Animation Standards

### Micro-interactions

**Timing:**
- Quick actions: 150-200ms (button hovers, small transitions)
- Content reveals: 250-350ms (modals, dropdowns)
- Page transitions: 300-500ms (route changes)

**Required Feedback:**
- Immediate visual response to all clicks/taps
- Loading states for operations >200ms
- Success/error confirmation for all user actions

### Animation Principles

- **Purposeful**: Animations should clarify relationships or provide feedback
- **Performant**: Use transform and opacity; avoid animating layout properties
- **Reducible**: Respect `prefers-reduced-motion` for accessibility
- **Smooth**: Easing functions feel natural (ease-out for entries, ease-in for exits)

---

## Responsive Design Requirements

### Breakpoints (Tailwind defaults)

- Mobile: 320px - 639px
- Tablet: 640px - 1023px
- Desktop: 1024px - 1535px
- Large Desktop: 1536px+

### Responsive Behaviors

**Navigation:**
- Desktop (≥1024px): Persistent sidebar + top header
- Tablet (640-1023px): Collapsible sidebar or tab-based navigation
- Mobile (<640px): Bottom tab bar or hamburger menu

**Course Cards:**
- Desktop: 3-4 column grid
- Tablet: 2 column grid
- Mobile: Single column stack

**Tables:**
- Desktop: Full table display
- Tablet: Horizontal scroll with sticky first column
- Mobile: Card-based layout or horizontal scroll

**Touch Targets:**
- Minimum 44x44px for all interactive elements on touch devices
- Generous spacing between tappable elements (minimum 8px gap)

---

## Accessibility Checklist

### Visual Accessibility

- [ ] All text meets WCAG AA contrast ratios
- [ ] Focus indicators visible on all interactive elements
- [ ] Color is never the sole method of conveying information
- [ ] Text is resizable up to 200% without loss of functionality
- [ ] No content flashes more than 3 times per second

### Keyboard Accessibility

- [ ] All functionality available via keyboard
- [ ] Logical tab order throughout the interface
- [ ] Skip links to main content and navigation
- [ ] Escape key closes modals and dismisses overlays
- [ ] Arrow keys navigate within components (tabs, menus, etc.)

### Screen Reader Accessibility

- [ ] Semantic HTML elements used correctly (nav, main, article, etc.)
- [ ] ARIA labels on icon-only buttons
- [ ] ARIA live regions for dynamic content updates
- [ ] Alt text on all meaningful images
- [ ] Form labels properly associated with inputs

### Motion & Cognitive Accessibility

- [ ] Respect `prefers-reduced-motion` preference
- [ ] No auto-playing video or audio
- [ ] Sufficient time for users to read and interact
- [ ] Clear error messages with recovery suggestions
- [ ] Consistent navigation and interaction patterns

---

## Page-Specific Guidelines

### Overview Dashboard

**Key Metrics Display:**
- Large, scannable numbers for courses in progress, completed, hours learned
- Visual charts for learning streaks and progress over time
- Recently accessed courses prominently featured
- Upcoming live sessions or deadlines highlighted

### My Courses (Active Courses)

**Course List:**
- Progress bars with clear percentage indicators
- "Continue Learning" CTA on each course card
- Filter by status (in progress, upcoming, completed)
- Sort by recent activity, deadline, or name

### Courses Catalog

**Discovery Features:**
- Filter by category, difficulty, instructor, duration
- Search with autocomplete suggestions
- Featured/recommended courses section
- Clear enrollment CTA with course details preview

### Messages

**Conversation UI:**
- Chat-style interface with clear sender identification
- Timestamp formatting (relative for recent, absolute for older)
- Unread message indicators
- Quick reply functionality
- File attachment previews

### Reports & Analytics

**Data Visualization:**
- Charts with clear legends and axis labels
- Tooltips on hover for detailed information
- Export functionality for deeper analysis
- Date range selectors with common presets
- Color-blind friendly chart colors

---

## Code Quality Standards

### Component Architecture

**React Best Practices:**
- Functional components with hooks
- Props typed with TypeScript interfaces
- Meaningful component and prop names
- Single Responsibility Principle (components do one thing well)

**File Organization:**
- Page components in `src/app/pages/`
- Reusable UI components in `src/app/components/ui/`
- Custom components in `src/app/components/figma/`
- Shared utilities and hooks in dedicated directories

### Styling Approach

**Tailwind CSS Guidelines:**
- Use utility classes for styling (no inline styles)
- Extract repeated patterns to components
- Use theme tokens from `theme.css` for colors
- Responsive modifiers for all layout shifts
- Group related utilities (layout, then spacing, then colors, etc.)

**CSS Custom Properties:**
- All theme tokens in CSS variables
- OKLCH color space for better color manipulation
- Dark mode support via CSS variable swapping

### Performance Considerations

- Lazy load route components with React Router
- Optimize images (WebP format, appropriate sizes)
- Minimize bundle size (code splitting, tree shaking)
- Avoid unnecessary re-renders (React.memo, useMemo, useCallback)
- Debounce search inputs and expensive operations

---

## Design Review Checklist

Use this checklist when reviewing UI changes:

### Visual Consistency
- [ ] Matches existing design patterns and component styles
- [ ] Uses design system colors, spacing, and typography
- [ ] Border radius consistent with component type
- [ ] Shadows and elevations follow established patterns

### Responsive Design
- [ ] Tested at mobile (375px), tablet (768px), and desktop (1440px) breakpoints
- [ ] No horizontal scroll on mobile
- [ ] Touch targets minimum 44x44px
- [ ] Text readable at all sizes
- [ ] Images and media scale appropriately

### Interaction Quality
- [ ] All interactive elements have hover states
- [ ] Focus states visible and distinct
- [ ] Active/pressed states provide feedback
- [ ] Disabled states clearly communicated
- [ ] Animations smooth and purposeful (150-500ms)

### Accessibility
- [ ] WCAG AA contrast ratios met
- [ ] Keyboard navigation works logically
- [ ] Screen reader testing passes
- [ ] ARIA labels on icon buttons
- [ ] Form inputs properly labeled
- [ ] Error messages specific and helpful

### Code Quality
- [ ] TypeScript types defined for props and state
- [ ] No console errors or warnings
- [ ] Follows React best practices
- [ ] Tailwind utilities used correctly
- [ ] No hardcoded colors or spacing values
- [ ] Performance optimized (no unnecessary re-renders)

### Content & UX
- [ ] Loading states for async operations
- [ ] Error states with recovery actions
- [ ] Empty states with helpful guidance
- [ ] Success confirmations for user actions
- [ ] Tooltips for unclear icons or actions

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Component Library](https://ui.shadcn.com/)
- [React Router v7 Documentation](https://reactrouter.com/)
- [Radix UI Accessibility](https://www.radix-ui.com/primitives/docs/overview/accessibility)
