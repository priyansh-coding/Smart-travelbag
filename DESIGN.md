# Michele Du

## Overview

**Product:** Michele Du
**URL:** https://micheledu.com/
**Surface type:** dashboard
**Audience:** Business users and internal teams
**Brand character:** Data-driven application interface with a rich, diverse color palette and 6 typefaces.

> **Note:** Surface detection confidence is low. Verify the inferred audience and brand context before relying on this file.

### Design Principles

- Data visibility — the most important metric should be visible without interaction.
- Progressive disclosure — surface summaries, reveal detail on demand.
- Efficiency over decoration — every pixel should communicate state or enable action.

## Colors

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

## Typography

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

## Spacing

**Base unit:** 4px

`space-1: 1px` · `space-2: 2px` · `space-3: 3px` · `space-4: 4px` · `space-5: 5px` · `space-6: 6px` · `space-7: 8px` · `space-8: 10px` · `space-9: 12px` · `space-10: 20px` · `space-11: 50px`

## Shapes

**Border radius:** `radius-sm: 4px` · `radius-md: 6px` · `radius-lg: 8px` · `radius-xl: 9px` · `radius-full: 12px` · `radius-6: 16px` · `radius-7: 20px` · `radius-8: 22px` · `radius-9: 33px` · `radius-full: 50%` · `radius-11: 100px` · `radius-12: 999px`

## Elevation

- **shadow-sm:** `rgba(0, 0, 0, 0) 0px 0px 0px 0.6px inset`
- **shadow-md:** `rgba(255, 255, 255, 0.54) 0px 0px 0px 0.5px, rgba(255, 255, 255, 0.33) 0px 0px 6px 0px, rgba(255, 255, 255, 0.18) 0px 0px 16px 0px`
- **shadow-lg:** `rgba(0, 0, 0, 0.22) 0px 8px 24px -14px, rgba(255, 255, 255, 0.16) 0px 0px 0px 1px inset`

## Motion

- **duration-fast:** `all`
- **duration-fast:** `none`
- **duration-base:** `color 0.2s`
- **duration-base:** `background 0.2s, color 0.2s`
- **duration-base:** `transform 0.26s cubic-bezier(0.3, 1.4, 0.5, 1)`
- **duration-slow:** `filter 0.35s`
- **duration-slow:** `2s linear infinite shimmer-text-shimmer-rvhumhzrg`
- **duration-slow:** `2.8s linear infinite shimmer-text-shimmer-q0et4bmrt`
- **duration-slow:** `3.2s ease-in-out infinite mdw-new-glow`

## Components

- **Buttons:** 5 detected
- **Links:** 7 detected
- **Inputs:** 1 detected
- **Navigation:** 1 elements
- **Forms:** 1 detected
- **Images:** 19 detected

## Do's and Don'ts

### Do

- Reference tokens by name, not raw values — agents and developers should use `color.text.primary`, not `#171717`.
- Define all interactive states: default, hover, focus-visible, active, disabled.
- Use the spacing scale for all padding, margin, and gap values.
- Write content in sentence case. Reserve ALL CAPS for acronyms only.
- Test every component at the smallest and largest breakpoint before shipping.

### Don't

- Do not introduce colors outside the extracted palette.
- Do not use arbitrary spacing values — stick to the scale.
- Do not mix border-radius values. Pin to the detected set (4px, 6px, 8px, 9px, 12px, 16px, 20px, 22px, 33px, 50%, 100px, 999px).
- Do not use decorative shadows on data-dense layouts.
- Do not hide critical status information behind interactions.
- Do not ship components without defining hover, focus-visible, and disabled states.

## Writing Tone

Efficient, data-forward, action-oriented. Labels over sentences.

## Authoring Workflow

When creating or updating a component guideline for this system, follow this sequence:

1. **State the intent** — one sentence on what the component does and why it exists.
2. **Map tokens** — list every color, spacing, typography, and radius token the component uses. No raw values.
3. **Define anatomy** — break the component into named parts (container, label, icon, etc.) with their token assignments.
4. **Specify states** — document every state: default, hover, focus-visible, active, disabled, loading, error, empty.
5. **Describe interactions** — keyboard, pointer, and touch behavior, including edge cases (long content, overflow, truncation).
6. **Add accessibility criteria** — write testable pass/fail checks (e.g. "focus ring must be visible at 3:1 contrast").
7. **List anti-patterns** — concrete examples of misuse with a brief explanation of why each is wrong.
8. **Close with a QA checklist** — a mechanical list of verifiable items (see Definition of Done below).

## Required Output Structure

Every component guideline produced from this system must contain these sections, in order:

1. Overview — purpose, when to use, when not to use.
2. Tokens and foundations — all referenced tokens from the tables above.
3. Anatomy and variants — named parts, variant matrix, responsive behavior.
4. States and interactions — full state table, keyboard/pointer/touch behavior.
5. Accessibility — ARIA attributes, contrast requirements, focus management, screen reader behavior.
6. Content guidelines — copy length, tone, capitalisation, placeholder text rules.
7. Anti-patterns — explicit examples of what not to build, with reasoning.

## Component Requirements

Every component built against this system must:

- Reference only tokens defined in the tables above — no hardcoded hex, px, or font values.
- Define all interactive states: default, hover, focus-visible, active, disabled, loading, error.
- Specify responsive behavior at the smallest and largest supported breakpoint.
- Handle edge cases: empty state, overflow / truncation, maximum content length.
- Include keyboard navigation (Tab, Enter, Escape, Arrow keys where applicable).
- Document ARIA roles, labels, and live-region behavior where relevant.
- Include known page component density: - **Buttons:** 5 detected
- **Links:** 7 detected
- **Inputs:** 1 detected
- **Navigation:** 1 elements
- **Forms:** 1 detected
- **Images:** 19 detected

## Definition of Done

A component is not complete until every item below is checked:

- Renders correctly in its default state (smoke test).
- All states documented and visually verified (hover, focus, disabled, loading, error, empty).
- All visual values use design tokens — zero hardcoded values.
- Keyboard navigation works without a pointer.
- No critical accessibility violations (contrast, ARIA, focus order).
- Tested at smallest and largest breakpoint.
- Anti-patterns section lists at least one concrete misuse example.
- Documentation covers purpose, usage, props/API, and limitations.
