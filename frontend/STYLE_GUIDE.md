# Cinerads Design System — Style Guide

> **Source of truth for all UI agents and developers.** Follow this guide strictly when building or modifying any landing page or marketing component.

---

## 1. Typography

### Font Stack

| Role | Font | Usage |
|------|------|-------|
| **Sans (primary)** | Inter | All body text, UI labels, nav, buttons |
| **Serif (accent)** | System serif (Georgia/ui-serif) | Section heading accents, italic emphasis |
| **Mono** | System monospace | Code, step numbers (01, 02, 03) |

### Loading
Inter is loaded via `next/font/google` in `src/app/layout.tsx` with `--font-inter` CSS variable.
The serif stack is the browser system serif (Georgia on macOS, defined in globals.css):

Tailwind maps:
- `font-sans` → Inter (via `--font-inter`)
- `font-serif` → `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`

### Heading Convention: Mixed Font Treatment

**All section headings must use the mixed sans + serif pattern.** The primary text is bold sans-serif; 1–3 accent words (usually a product term or differentiator) are serif italic orange.

```tsx
// Pattern
<h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-foreground">
  Primary heading text{" "}
  <span className="font-serif italic text-primary">Accent Words</span>
</h2>
```

**Examples across sections:**
- Hero: `Turn Any Product URL / Into` **`UGC Video Ads.`**
- HowItWorks: `How Cinerads Generates Your` **`UGC Video Ads`**
- Features: `Everything You Need to Create` **`UGC Video Ads`** `at Scale`
- Feature tiles: `Zero-Input Product` **`Import`** / `Your AI Brand` **`Spokesperson`**

### Section Label (above h2)
Every section heading must have a small uppercase label above it:
```tsx
<p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
  Section Name
</p>
```

### Type Scale

| Element | Class |
|---------|-------|
| Hero h1 | `text-[clamp(2.4rem,7vw,5.8rem)] font-semibold leading-[1.02] tracking-[-0.03em]` |
| Section h2 | `text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight` |
| Feature h3 | `text-2xl md:text-3xl font-bold tracking-tight` |
| Step h3 | `text-base font-semibold` |
| Body large | `text-lg leading-relaxed` |
| Body | `text-base leading-relaxed` |
| Body small | `text-sm leading-relaxed` |
| Label | `text-xs uppercase tracking-[0.15em]` |

---

## 2. Colors

All colors are CSS custom properties defined in `src/app/globals.css`.

### Brand Colors
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#f07a00` | `#f07a00` | Orange accent, CTAs, serif text, links |
| `--background` | `#f7f7f7` | `#000000` | Page background |
| `--background-secondary` | `#efefef` | `#020202` | Used sparingly (avoid for section breaks) |
| `--foreground` | `#111111` | `#f5f5f5` | Primary text |
| `--muted-foreground` | `#666666` | `#767676` | Secondary text, labels, descriptions |
| `--border` | `#d8d8d8` | `#1f1f1f` | Borders, dividers |
| `--card` | `#ffffff` | `#080808` | Card/surface backgrounds |

### Usage Rules
- **Section backgrounds:** Use `bg-background` for all landing sections. Only use `bg-background-secondary` for very intentional subtle breaks. Never alternate white/gray between sections.
- **The testimonial section** is the only exception: `bg-[#050505]` for dramatic dark contrast.
- **Accent color `text-primary`** must be used on serif italic heading accents, CTA buttons, links, and subtext highlights.
- **No white text** on light backgrounds. Use `theme="auto"` on Logo in light contexts.

---

## 3. Section Layout Pattern

### Spacing
Each section should fit comfortably within one viewport height (900px target).

| Section | Padding |
|---------|---------|
| Section vertical padding | `py-20` (default) |
| Section with hero-level content | `py-24 md:py-28` |
| Heading-to-content gap | `mb-12` |
| Feature block gap | `py-14` per block, `gap-10 md:gap-12` |

### Max widths
- Content: `max-w-6xl mx-auto px-4 sm:px-6`
- Narrow content (headings, testimonial): `max-w-5xl mx-auto`
- Text blocks: `max-w-lg mx-auto` (hero subtitle), `max-w-3xl` (testimonial)

### Section background rule
```
Hero → bg-background (with warm radial gradient)
VideoCarousel → bg-background
HowItWorks → bg-background (NO gray separation)
Features → bg-background
MetricsBar → bg-background
Testimonial → bg-[#050505] (intentional dark break)
Pricing → bg-background
FAQ → bg-background
FinalCTA → bg-background
Footer → bg-background-secondary
```

---

## 4. Components

### URL Input CTA
- Container: `max-w-2xl mx-auto`
- Input height: `h-14`
- Rounded: `rounded-full`
- Focus glow: `focus-within:shadow-[0_0_20px_rgba(249,115,22,0.14)]`
- No trust badges below (removed "No credit card required..." line)

### Buttons
- Primary CTA: `rounded-full bg-primary px-6 py-3 text-sm font-medium text-white hover:bg-orange-600`
- Secondary: `rounded-full border border-border px-4 py-2 text-sm`

### Feature Tiles (h3)
Always split into sans + serif:
```tsx
<h3 className="text-2xl md:text-3xl font-bold tracking-tight">
  {sans part}
  <span className="font-serif italic text-primary">{serif accent}</span>
</h3>
```

### Quote Section
- Background: `bg-[#050505]`
- Quote marks: `text-7xl text-primary/50 font-serif`
- Blockquote: `font-serif font-medium text-white italic`
- No `font-medium` on sans text in this section

---

## 5. Copy Rules

- **No em dashes (—)** in marketing copy. Use commas, colons, or rewrite.
- **Brand name:** `Cinerads` (lowercase r) in all visual/marketing contexts
- **Metadata/legal/code:** `CineRads` may remain in structured data
- Headline case for all h1/h2/h3 titles
- Sentence case for body copy

---

## 6. Prohibited Patterns

| Don't | Do |
|-------|-----|
| Section h2 with no label above | Always add uppercase label |
| Full sans-serif on section titles | Always use mixed serif accent |
| `theme="dark"` Logo on light backgrounds | Use `theme="auto"` |
| Em dashes in copy | Use commas or colons |
| Alternating white/gray section backgrounds | Keep all sections `bg-background` |
| `text-primary/20` quote marks on dark bg | Use `text-primary/50` minimum |
| Trust badges under hero input | Keep hero input clean |
| `max-w-xl` URL input | Use `max-w-2xl` |
