---
epic: 9
title: 'Observability & Platform Health'
status: 'partial'
frs_covered: []
nfrs_addressed: ['NFR5', 'NFR6', 'NFR7', 'NFR11']
depends_on: ['Epic 2 (auth)', 'Epic 8 (admin)']
architecture_stack: 'Sentry SDK (Browser + Deno), DataFast, Vitest, Playwright, GitHub Actions'
auditDate: '2026-03-03'
---

# Epic 9 - Observability & Platform Health: User Stories

## Epic Overview

Production monitoring, error tracking, analytics event tracking, and platform reliability tooling. Stories 9.1-9.2 are implemented. Stories 9.3-9.5 are deferred to Phase 2.

This epic was **not in the original PRD**. Observability infrastructure was added during and after Phase 1 implementation to ensure production reliability and provide conversion analytics.

### Architecture Context

- **Error Tracking:** Sentry SDK (Browser for frontend, Deno SDK for edge functions)
- **Analytics:** DataFast (client-side event pipeline)
- **Testing:** Vitest (unit), Playwright (e2e), GitHub Actions (CI)
- **Rate Limiting:** In-memory rate limiter (`_shared/rate-limit.ts`), Redis upgrade planned (Phase 2)
- **Retry:** `_shared/retry.ts` - exponential backoff for external API calls

---

## [DONE] Story 9.1: Sentry Error Tracking Integration

**As a** platform operator,
**I want to** have automatic error capture across frontend and edge functions,
**So that** production errors are tracked, triaged, and resolved quickly with full context.

### Acceptance Criteria

1. **Frontend initialization**: Sentry Browser SDK initialized in the Next.js app with `SENTRY_DSN` and `SENTRY_ENVIRONMENT` tags. Captures unhandled exceptions and rejections.
2. **Edge function utility**: `supabase/functions/_shared/sentry.ts` exports `captureException(error, context)` for use in all edge functions.
3. **Error capture scope**: Generation failures, API errors (OpenRouter, NanoBanana, Kling), webhook processing failures, and auth errors captured with contextual metadata.
4. **Context metadata**: Error events include user ID, generation ID (when available), edge function name, and request metadata.
5. **Performance monitoring**: Key transactions monitored (scraping duration, script generation time, video polling cycles).
6. **Environment separation**: `SENTRY_ENVIRONMENT` distinguishes production vs staging errors.
7. **Non-blocking**: Sentry calls are fire-and-forget. Sentry failures never block the main request flow.

### Implementation Details

- Backend utility: `supabase/functions/_shared/sentry.ts`
- Usage example: `stripe-webhook/index.ts` wraps error handling with `captureException()`
- Frontend: Sentry SDK initialization in app root or layout
- Environment variables: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`

### Error Handling

- If `SENTRY_DSN` is not set, `captureException()` is a no-op (graceful degradation)
- Sentry SDK errors are caught and logged to `console.error` but never thrown

---

## [DONE] Story 9.2: DataFast Analytics Event Tracking

**As a** product owner,
**I want to** track key conversion events across the user funnel,
**So that** I can analyze conversion rates, identify drop-off points, and optimize the user journey.

### Acceptance Criteria

1. **Event library**: `frontend/src/lib/datafast.ts` exports typed event tracking functions for all key funnel events.
2. **Events tracked**:
   - `productImported` - User successfully imports/scrapes products
   - `previewGenerated` - Composite preview images generated (wizard step 3)
   - `scriptGenerated` - AI script generation completes (wizard step 5)
   - `videoGenerationStarted` - User approves and starts video generation
   - `paywallShown` - Paywall modal displayed to user
   - `checkoutStarted` - User clicks through to Stripe checkout
   - `creditsPurchased` - Successful purchase (subscription or pack)
   - `purchaseConfirmed` - Purchase confirmation modal shown
3. **Event payloads**: Each event includes relevant context (product ID, plan name, generation mode, quality tier, credits amount).
4. **Timing**: Events fire at the correct points in the user journey (not too early, not after errors).
5. **Type safety**: All event functions are typed with required and optional payload fields.
6. **Client-side only**: DataFast runs entirely on the client. No server-side event emission.

### Implementation Details

- Library: `frontend/src/lib/datafast.ts`
- Integration points: Generation wizard, paywall modal, checkout flow, dashboard
- DataFast SDK: Initialized once, events sent via `datafast.track()` or equivalent

### Error Handling

- DataFast tracking failures are silently caught (never block user flow)
- Missing DataFast initialization gracefully degrades to no-op

---

## Story 9.3: Platform Health Dashboard (Admin)

**Status:** Deferred Phase 2

**As an** admin,
**I want to** see a real-time platform health dashboard,
**So that** I can monitor error rates, API response times, generation queue depth, and overall system health.

### Acceptance Criteria

1. **Error rate display**: Real-time error rate with spike detection and alerting thresholds.
2. **API response times**: Percentile charts (p50, p95, p99) for key endpoints (scraping, script generation, video polling).
3. **Generation queue**: Current queue depth, average completion time, success/failure rate trends.
4. **Webhook reliability**: Stripe webhook success rate, processing time, and dedup metrics.
5. **Sentry integration**: Drill-down from error rate chart to Sentry issue list.
6. **Admin-only**: Page restricted to users with `profiles.role = 'admin'`.
7. **Time range**: Selectable time ranges (1h, 24h, 7d, 30d).

### Implementation Notes

- Depends on: Story 9.1 (Sentry data), Story 8.1 (Admin dashboard framework)
- Data sources: Sentry API, Supabase DB aggregation queries, DataFast analytics
- Page: `/admin/health` (within AdminShell layout)

---

## Story 9.4: Redis-backed Rate Limiting

**Status:** Deferred Phase 2

**As the** platform,
**I want to** enforce rate limits consistently across all edge function instances using Redis,
**So that** abuse prevention works reliably regardless of which function instance handles a request.

### Acceptance Criteria

1. **Redis backend**: Upstash Redis (or equivalent) integrated as rate limit store, replacing in-memory `Map`.
2. **Sliding window**: Rate limiting uses sliding window counters for smooth rate enforcement.
3. **Scraping limits**: Per-user (60/hr authenticated) and per-IP (10/hr unauthenticated) rate limits on `scrape-product/`.
4. **Generation limits**: Per-user concurrent generation limit (3 concurrent jobs).
5. **Adaptive backoff**: Rate limit thresholds adjust based on API failure rates (reduce limits during provider outages).
6. **Graceful fallback**: If Redis is unreachable, falls back to current in-memory rate limiter with logged warning.
7. **Response headers**: Rate limit info returned in response headers (`X-RateLimit-Remaining`, `X-RateLimit-Reset`).

### Implementation Notes

- Key file: `supabase/functions/_shared/rate-limit.ts` - Replace `Map` with Redis client
- Service: Upstash Redis (serverless, compatible with Deno Edge Functions)
- Environment variables: `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN`

---

## Story 9.5: Generation Failure Recovery & Auto-Retry

**Status:** Deferred Phase 2

**As a** user whose video generation failed,
**I want to** have automatic retry for transient failures and a one-click manual retry option,
**So that** I don't lose my work or credits when temporary errors occur.

### Acceptance Criteria

1. **Auto-retry**: Transient failures (network timeouts, 5xx errors, rate limits) automatically retried with exponential backoff before marking generation as failed.
2. **Retry budget**: Maximum 3 automatic retries per segment. Total retry window capped at 5 minutes.
3. **User countdown**: During automatic retry, user sees a countdown timer with retry attempt number and estimated time remaining.
4. **Manual retry**: One-click "Retry" button on failed generations. Re-triggers the approval flow without re-scripting (reuses existing script and composite image).
5. **State preservation**: Failed generation preserves all state (script, composite, settings) for seamless retry.
6. **Credit handling**: Credits already debited are tracked. On manual retry, no additional credits charged (original debit still applies). On final failure after all retries, full refund issued.
7. **Retry metrics**: Retry attempts, outcomes, and failure reasons tracked in Sentry for reliability analysis.
8. **Partial success**: If some segments complete and others fail, completed segments are preserved. Only failed segments are retried.

### Implementation Notes

- Backend: `generate-video/index.ts` and `video-status/index.ts` - Enhanced retry logic
- Frontend: Generation status page (`/generate/[id]`) - Retry UI with countdown
- Existing: `_shared/retry.ts` handles individual API call retries; this story extends to workflow-level retry
- Credit operations: `_shared/credits.ts` - Track retry vs new debit

---

## Story Dependencies

```
Story 9.1 (Sentry) ──> Story 9.3 (Health Dashboard)
Story 9.2 (DataFast) ──> Story 9.3 (Health Dashboard data source)
Story 8.1 (Admin Dashboard) ──> Story 9.3 (Admin UI framework)

Story 9.4 (Redis Rate Limiting) - Independent (replaces existing rate-limit.ts)
Story 9.5 (Failure Recovery) - Depends on existing retry.ts + Sentry (9.1)
```

---

## Implementation Status

| Story | Status | Notes |
|-------|--------|-------|
| 9.1 Sentry Error Tracking | Done | Frontend + edge functions integrated |
| 9.2 DataFast Analytics | Done | 8 funnel events tracked |
| 9.3 Health Dashboard | Deferred Phase 2 | Requires Sentry API integration |
| 9.4 Redis Rate Limiting | Deferred Phase 2 | Upstash Redis recommended |
| 9.5 Failure Recovery | Deferred Phase 2 | Individual API retry exists; workflow retry pending |
