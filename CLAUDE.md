# AIUGC — Claude Code Instructions

## Project Overview

AI UGC Generator — a micro-SaaS where e-commerce brands paste their store URL, auto-import products, build a custom AI persona, and generate short-form UGC video ads (Hook/Body/CTA structure).

**Stack:** Next.js 14 (App Router) + Tailwind/shadcn on Vercel | Supabase (Auth + Edge Functions + PostgreSQL + Storage) | OpenRouter | NanoBanana | Kling 3.0 | Stripe

**Key docs:**
- PRD: `_bmad-output/planning-artifacts/ai-ugc-generator-prd.md`
- Architecture: `_bmad-output/planning-artifacts/architecture.md`
- Epics & Stories: `_bmad-output/planning-artifacts/epics.md`
- Frontend: `frontend/` (Next.js 14 App Router)
- Backend: `supabase/` (Edge Functions, migrations)

## BMAD Framework

This project uses BMAD v6.0.3 for project management. All planning artifacts are in `_bmad-output/planning-artifacts/`. Slash commands for BMAD workflows are in `.claude/commands/bmad-*.md`.

## Development Conventions

### Frontend
- Next.js 14 App Router (`frontend/src/app/`)
- Components in `frontend/src/components/`
- Shadcn/UI components — use `npx shadcn@latest add <component>` from `frontend/`
- Zustand stores in `frontend/src/stores/`
- Type definitions in `frontend/src/types/`
- Schemas (Zod) in `frontend/src/schemas/`

### Backend
- Supabase Edge Functions (Deno) in `supabase/functions/`
- Database migrations in `supabase/migrations/`
- Use RLS policies for data isolation
- Never store secrets in code — use environment variables

### Code Style
- TypeScript strict mode
- Prefer named exports
- Use server components by default, `'use client'` only when needed
- Error handling: try/catch with meaningful error messages

---

## QA Handoff Protocol — Build ↔ Cowork Loop

This project uses a file-based QA handoff between Claude Code (builder) and Cowork (visual QA tester using Claude in Chrome).

### The Loop

```
1. Claude Code completes a story implementation
2. Claude Code runs /qa-signal → writes .qa/build_signal.json
3. User tells Cowork: "QA epic X story Y"
4. Cowork browses localhost, tests FRs visually, takes screenshots
5. Cowork writes .qa/qa_feedback.json
6. User tells Claude Code: /qa-feedback
7. Claude Code reads feedback, fixes issues
8. If re-qa needed → back to step 2
9. If passed → proceed to next story
```

### After Every Story Implementation

When you finish implementing a story, **always**:
1. Ensure the dev server is running (`cd frontend && bun dev` or `npm run dev`)
2. Run `/qa-signal` to write the build signal file
3. Tell the user: "Ready for QA. Tell Cowork: **QA epic X story Y.Z**"

### Before Starting a New Story

Always check:
1. Read `.qa/qa_feedback.json` — if there's pending feedback, address it first
2. Read `.qa/build_signal.json` — if status is `ready_for_qa`, QA hasn't happened yet; wait

### QA Protocol Files

| File | Purpose |
|------|---------|
| `.qa/build_signal.json` | You write this after building. Tells Cowork what to test |
| `.qa/qa_feedback.json` | Cowork writes this after testing. You read via /qa-feedback |
| `.qa/qa_checklist.md` | Master FR checklist — all 38 FRs with test steps |
| `.qa/screenshots/` | Cowork saves screenshots of issues here |
| `.qa/cowork-qa-skill.md` | Instructions Cowork follows for QA (read-only for you) |

### Slash Commands

| Command | When to Use |
|---------|-------------|
| `/qa-signal` | After completing a story — signals Cowork to test |
| `/qa-feedback` | After Cowork finishes QA — reads and acts on feedback |

### FR Coverage Map (Quick Reference)

```
Epic 1 (Scraping & Import):  FR1-FR6   → Routes: /, /products
Epic 2 (Auth & Account):     FR7-FR10  → Routes: /signup, /login, /settings
Epic 3 (Persona Creation):   FR11-FR17 → Routes: /personas/new, /personas, /personas/[id]
Epic 4 (Paywall & Billing):  FR31-FR36 → Routes: /generate (paywall), /dashboard
Epic 5 (Script & Image Gen): FR18-FR20 → Routes: /generate
Epic 6 (Video Gen & Delivery): FR21-FR26 → Routes: /generate/[id]
Epic 7 (Dashboard & Library): FR37-FR38 → Routes: /dashboard, /history
```

---

## Story Implementation Order

Follow the parallelization defined in epics.md:
1. Epic 1 + Epic 2 (parallel — no dependencies)
2. Epic 3 + Epic 4 (parallel — both depend on Epic 2)
3. Epic 5 (depends on Epics 1, 2, 3)
4. Epic 6 (depends on Epics 4, 5)
5. Epic 7 (depends on Epics 2, 6)

Within each epic, implement stories in order (1.1 → 1.2 → ... → 1.8).

## Important Rules

- **Never skip QA signaling** — always run `/qa-signal` after completing a story
- **Never ignore QA feedback** — always run `/qa-feedback` before starting the next story if feedback exists
- **Always reference the PRD** when implementing — the FRs are the source of truth
- **Test data**: For stories requiring test data (e.g., scraped products for Epic 3), create seed data or use the previously built features to generate it
