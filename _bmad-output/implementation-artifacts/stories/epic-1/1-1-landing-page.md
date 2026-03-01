# Story 1.1: Landing Page with URL Input CTA

Status: ready-for-dev

## Story

As a **visitor**,
I want to **see a compelling landing page with a prominent URL input field**,
So that **I can immediately understand the product value and start using it without signing up**.

## Acceptance Criteria

1. **Given** a new visitor navigates to the root URL
   **When** the page loads
   **Then** a hero section is displayed with:
   - Headline communicating the core value prop (AI UGC video ads from your store URL)
   - Subheadline explaining the 3-step process
   - A prominent URL input field with a "Get Started" CTA button
   **And** the page renders correctly on Chrome, Firefox, Safari, and Edge (latest 2 versions)
   **And** the page is responsive (desktop-first, functional on tablet)

2. **Given** the visitor scrolls below the fold
   **When** additional sections come into view
   **Then** a "How It Works" section displays 3 steps: Paste URL → Build Persona → Generate Videos
   **And** a pricing teaser section shows plan highlights (Starter $15/mo, Growth $59/mo)
   **And** a FAQ accordion section addresses common questions
   **And** a feature breakdown section highlights key differentiators

3. **Given** the URL input field is empty
   **When** the user clicks the CTA button
   **Then** a validation message appears ("Please enter a valid store URL")
   **And** the input field gains a red border / error state

4. **Given** the user enters a URL
   **When** the user clicks the CTA button
   **Then** nothing happens yet (backend not wired  -  this story is frontend scaffold only)
   **And** the URL value is captured in component state for Story 1.5 integration

## Tasks / Subtasks

- [ ] Initialize Next.js 14 project with TypeScript and App Router (AC: all)
  - [ ] Run `bun create next-app` with TypeScript + App Router options
  - [ ] Configure Tailwind CSS
  - [ ] Install and initialize shadcn/ui (`bunx --bun shadcn-ui@latest init`)
  - [ ] Set up `src/` directory structure: `app/`, `components/`, `lib/`
- [ ] Create shared utility and type files (AC: all)
  - [ ] `lib/utils.ts`  -  `cn()` class merge helper (shadcn default)
  - [ ] `lib/types.ts`  -  `Product`, `BrandSummary`, `ScrapeResponse` type stubs
  - [ ] `lib/constants.ts`  -  plan limits, pricing data, attribute options
- [ ] Create root layout `app/layout.tsx` (AC: 1)
  - [ ] HTML metadata (title, description, OG tags)
  - [ ] Font loading (Inter or similar clean sans-serif)
  - [ ] Global CSS import
- [ ] Create marketing route group `app/(marketing)/layout.tsx` (AC: 1, 2)
  - [ ] Build `components/layout/navbar.tsx`  -  logo + nav links (Features, Pricing, FAQ)
  - [ ] Build `components/layout/footer.tsx`  -  minimal footer with links
- [ ] Build landing page `app/(marketing)/page.tsx` (AC: 1, 2)
  - [ ] Build `components/landing/hero-section.tsx`  -  headline, subheadline, URL input + CTA
  - [ ] Build `components/landing/how-it-works.tsx`  -  3-step visual explainer with icons
  - [ ] Build `components/landing/pricing-section.tsx`  -  plan cards (Starter + Growth)
  - [ ] Build `components/landing/faq-section.tsx`  -  shadcn Accordion with 5-7 FAQs
- [ ] Add URL input validation on CTA click (AC: 3, 4)
  - [ ] Basic URL format validation (starts with http/https)
  - [ ] Error state styling on input
  - [ ] State management for URL value
- [ ] Set up Supabase project scaffold (AC: all)
  - [ ] Create `supabase/` directory with `config.toml`, `migrations/`, `functions/`, `functions/_shared/`
  - [ ] Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` placeholders

## Dev Notes

- **Package manager:** `bun` exclusively  -  NEVER npm/yarn/pnpm
- **Component naming:** PascalCase files (e.g., `HeroSection.tsx`)
- **Page naming:** kebab-case dirs (e.g., `app/(marketing)/`)
- **shadcn/ui components** go in `src/components/ui/`  -  install: Button, Input, Card, Accordion, Badge
- Do **NOT** create the `products` table yet  -  tables created when stories need them
- Do **NOT** wire the URL input to any backend  -  that happens in Story 1.5
- Supabase project structure is created locally but no Edge Functions or migrations yet
- The landing page is SSR/SSG  -  no client-side auth needed
- Pricing section is static content for now  -  dynamic plan data comes with Epic 4

### Project Structure Notes

```
ugcfarmai/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   │   ├── layout.tsx          # Navbar + Footer
│   │   │   │   └── page.tsx            # Landing page
│   │   │   └── layout.tsx              # Root layout
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn/ui
│   │   │   ├── layout/
│   │   │   │   ├── navbar.tsx
│   │   │   │   └── footer.tsx
│   │   │   └── landing/
│   │   │       ├── hero-section.tsx
│   │   │       ├── how-it-works.tsx
│   │   │       ├── pricing-section.tsx
│   │   │       └── faq-section.tsx
│   │   └── lib/
│   │       ├── utils.ts
│   │       ├── types.ts
│   │       └── constants.ts
│   ├── .env.local
│   ├── package.json
│   └── tsconfig.json
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── functions/
│       └── _shared/
└── .gitignore
```

### References

- [Source: architecture.md#Frontend Architecture  -  Pages (App Router)]
- [Source: architecture.md#Project Directory Structure]
- [Source: architecture.md#Naming Conventions]
- [Source: PRD#UJ1  -  First-Time Store Owner  -  Discovery to First Scrape]
- [Source: PRD#PT3  -  Browser Compatibility]
