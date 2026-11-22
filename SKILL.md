---
name: design-system-michele-du
description: >
  Apply the Michele Du design system when building or updating UI.
  Use when creating components, choosing colors or typography,
  or reviewing designs for dashboard interfaces.
---

# Michele Du — Design System Skill

## When to Use

- Building new UI components for Michele Du.
- Reviewing or updating existing component styles.
- Choosing colors, typography, or spacing for dashboard pages.
- Checking designs against the extracted token set.

## Context

- **Product:** Michele Du — https://micheledu.com/
- **Surface:** dashboard
- **Audience:** Business users and internal teams
- **Character:** Data-driven application interface with a rich, diverse color palette and 6 typefaces.

## Tokens

### Colors

| Token | Value | Role |
|-------|-------|------|
| color-15 | `#F3F3F3` | Background |
| color-1 | `#161617` | Text Primary |
| color-2 | `#0000EE` | Text Primary |
| color-4 | `#878A8C` | Text Secondary |
| color-5 | `#FF7D6B` | Accent |
| color-6 | `#FF7CA4` | Accent |
| color-7 | `#03C37B` | Accent |
| color-8 | `#FF79FA` | Accent |
| color-9 | `#FF79FB` | Accent |
| color-10 | `#FF955C` | Accent |
| color-11 | `#FFAA4F` | Accent |
| color-12 | `#A1D747` | Accent |
| color-13 | `#EFC936` | Accent |
| color-14 | `#DFE301` | Accent |
| color-3 | `#A86BD6` | Background Dark |
| color-16 | `#FFFFFF` | Text Light |

### Typography

**Font stack:** Beausite Classic Clear, sans-serif, Fira Code, Beausite Classic Light, Beausite Classic Regular, Beausite Classic Semibold

| Level | Size | Usage |
|-------|------|-------|
| text-xs | 9px | Captions, metadata |
| text-sm | 12px | Labels, secondary text |
| text-base | 14px | Body text (default) |
| text-lg | 16px | Subheadings, emphasis |
| text-xl | 48px | Section headings |

**Weight scale:** 300 · 350 · 400 · 500 · 600
**Line heights:** 19.2px · 14.4px · 16.8px · 14px · 48px · 38.4px · 12px · 18px · 16.5px · 10.8px · 9px · 10px

### Spacing

**Base unit:** 4px

`space-1: 1px` · `space-2: 2px` · `space-3: 3px` · `space-4: 4px` · `space-5: 5px` · `space-6: 6px` · `space-7: 8px` · `space-8: 10px` · `space-9: 12px` · `space-10: 20px` · `space-11: 50px`

### Shapes

**Border radius:** `radius-sm: 4px` · `radius-md: 6px` · `radius-lg: 8px` · `radius-xl: 9px` · `radius-full: 12px` · `radius-6: 16px` · `radius-7: 20px` · `radius-8: 22px` · `radius-9: 33px` · `radius-full: 50%` · `radius-11: 100px` · `radius-12: 999px`

### Elevation

- **shadow-sm:** `rgba(0, 0, 0, 0) 0px 0px 0px 0.6px inset`
- **shadow-md:** `rgba(255, 255, 255, 0.54) 0px 0px 0px 0.5px, rgba(255, 255, 255, 0.33) 0px 0px 6px 0px, rgba(255, 255, 255, 0.18) 0px 0px 16px 0px`
- **shadow-lg:** `rgba(0, 0, 0, 0.22) 0px 8px 24px -14px, rgba(255, 255, 255, 0.16) 0px 0px 0px 1px inset`

### Motion

- **duration-fast:** `all`
- **duration-fast:** `none`
- **duration-base:** `color 0.2s`
- **duration-base:** `background 0.2s, color 0.2s`
- **duration-base:** `transform 0.26s cubic-bezier(0.3, 1.4, 0.5, 1)`
- **duration-slow:** `filter 0.35s`
- **duration-slow:** `2s linear infinite shimmer-text-shimmer-rvhumhzrg`
- **duration-slow:** `2.8s linear infinite shimmer-text-shimmer-q0et4bmrt`
- **duration-slow:** `3.2s ease-in-out infinite mdw-new-glow`

## Component Inventory

- **Buttons:** 5 detected
- **Links:** 7 detected
- **Inputs:** 1 detected
- **Navigation:** 1 elements
- **Forms:** 1 detected
- **Images:** 19 detected

## Constraints

### Always

- Use tokens from the tables above — do not introduce new values.
- Include hover, focus-visible, and disabled states for interactive elements.
- Follow the 4px spacing grid.
- Meet WCAG 2.2 AA contrast minimums.

### Never

- Do not introduce colors outside the extracted palette.
- Do not use arbitrary spacing values — stick to the scale.
- Do not mix border-radius values. Pin to the detected set (4px, 6px, 8px, 9px, 12px, 16px, 20px, 22px, 33px, 50%, 100px, 999px).
- Do not use decorative shadows on data-dense layouts.
- Do not hide critical status information behind interactions.
- Do not ship components without defining hover, focus-visible, and disabled states.

## Tone

Efficient, data-forward, action-oriented. Labels over sentences.

## Authoring Workflow

When creating or documenting a component for this system:

1. State intent — one sentence on purpose.
2. Map tokens — list every token the component uses.
3. Define anatomy — named parts with token assignments.
4. Specify states — default, hover, focus-visible, active, disabled, loading, error, empty.
5. Describe interactions — keyboard, pointer, touch, edge cases.
6. Add a11y criteria — testable pass/fail checks.
7. List anti-patterns — concrete misuse examples.
8. Close with the Definition of Done checklist.

## Output Structure

Component guidelines must contain, in order:

1. Overview (purpose, when to use, when not to use)
2. Tokens and foundations
3. Anatomy, variants, responsive behavior
4. States and interactions
5. Accessibility (ARIA, contrast, focus, screen reader)
6. Content guidelines (copy rules, tone)
7. Anti-patterns with reasoning

## Component Requirements

- Reference only tokens from the tables above.
- Define all states: default, hover, focus-visible, active, disabled, loading, error.
- Handle edge cases: empty, overflow, truncation, max content.
- Include keyboard navigation behavior.
- Document ARIA roles and labels.

## Definition of Done

- Default state renders (smoke test).
- All states visually verified.
- Zero hardcoded visual values — tokens only.
- Keyboard navigation works without pointer.
- No critical a11y violations.
- Tested at min and max breakpoint.
- At least one anti-pattern documented.
- Purpose, usage, and limitations documented.
