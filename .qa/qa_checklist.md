# AIUGC — QA Checklist (PRD v2.0)

Master checklist for visual QA testing. Each FR maps to specific routes and UI behaviors to verify.

---

## Epic 1: Product Discovery — Landing, Scraping & Import

### FR1 — Store URL Submission
- [ ] Homepage has prominent URL input field
- [ ] "Get Started" / submit button is visible and clickable
- [ ] Submitting a URL triggers scraping (loading state visible)
- Route: `/`

### FR2 — Product Data Extraction
- [ ] Scraped products show: name, image(s), description, price, category/tags
- [ ] Product cards render correctly with all data fields
- Route: scrape results view

### FR3 — AI Brand Summary
- [ ] Brand summary appears after scraping (tone, demographic, selling points)
- [ ] Summary is contextually relevant to the scraped store
- Route: scrape results view

### FR4 — Product Review & Edit
- [ ] Products are inline-editable (name, description, price)
- [ ] Confirm button saves edits
- [ ] Changes persist after page reload
- Route: product review page

### FR5 — Manual Product Upload
- [ ] Upload form with: name, description, price, image upload
- [ ] Image upload works (drag & drop or file picker)
- [ ] Product appears in library after upload
- Route: `/products/upload` or similar

### FR6 — Shopify + Generic Fallback
- [ ] Shopify URLs scrape correctly
- [ ] Non-Shopify URLs attempt generic HTML scrape
- [ ] Error shown if scraping fails completely
- Route: `/` (URL input)

---

## Epic 2: Authentication & Account Management

### FR7 — Email + Password Registration
- [ ] Signup form with email + password fields
- [ ] Validation on email format and password strength
- [ ] Account created, redirected to dashboard
- Route: `/signup`

### FR8 — Google OAuth
- [ ] "Sign in with Google" button visible
- [ ] OAuth flow completes and redirects back
- [ ] Profile auto-created for new OAuth users
- Route: `/login`, `/signup`

### FR9 — Soft Auth Gate After Scraping
- [ ] Unauthenticated user who scraped sees auth prompt
- [ ] Scraped data persists through auth flow
- [ ] After login, user sees their scraped products
- Route: post-scrape transition

### FR10 — Account Settings
- [ ] Settings page shows email, name, current plan
- [ ] Display name editable
- [ ] Subscription info visible
- Route: `/settings`

---

## Epic 3: AI Persona Creation

### FR11 — 9-Attribute Character Builder
- [ ] Builder UI shows all 9 attributes: gender, skin tone, age, hair color, hair style, eye color, body type, clothing style, accessories
- [ ] Each attribute has visual controls (sliders, pickers, grids)
- Route: `/personas/new`

### FR12 — Predefined Attribute Options
- [ ] Each attribute has selectable predefined options
- [ ] Visual controls are intuitive (gradient pickers, option grids)
- [ ] Selections are visually indicated
- Route: `/personas/new`

### FR13 — 4 Persona Image Generation
- [ ] Submitting attributes generates 4 images
- [ ] Images load within ~30 seconds
- [ ] All 4 images are distinct and match attributes
- Route: `/personas/new` (post-submit)

### FR14 — Persona Image Selection
- [ ] User can click to select preferred image
- [ ] Selected image is visually highlighted
- Route: `/personas/new` (post-generate)

### FR15 — Persona Persistence
- [ ] Selected persona appears in persona library
- [ ] Persona available in video generation wizard
- Route: `/personas`, `/generate`

### FR16 — Persona Regeneration
- [ ] "Regenerate" button available after initial generation
- [ ] Adjusting attributes + regenerate produces new images
- Route: `/personas/new`, `/personas/[id]`

### FR17 — Persona Slot Limits
- [ ] Starter user blocked at 1 persona
- [ ] Growth user blocked at 3 personas
- [ ] Upgrade prompt shown when limit reached
- Route: `/personas/new`

---

## Epic 4: Paywall & Subscription Billing

### FR31 — Paywall at First Generation
- [ ] Clicking "Generate" with 0 credits triggers paywall modal
- [ ] Paywall blocks generation until subscribed
- Route: `/generate` (at generate step)

### FR32 — Plan Comparison
- [ ] Paywall shows Starter and Growth tiers
- [ ] Feature comparison visible (credits, personas, price)
- Route: paywall modal

### FR33 — Stripe Checkout
- [ ] Selecting plan redirects to Stripe checkout
- [ ] After payment, redirected back with active subscription
- Route: paywall → Stripe → dashboard

### FR34 — Free Trial Credits
- [ ] New user starts with free credits (1 generation)
- [ ] Credit count visible in dashboard
- Route: `/dashboard`

### FR35 — Credit Balance Display
- [ ] Credit balance shown in dashboard/sidebar
- [ ] Balance decrements after generation
- Route: `/dashboard`, sidebar

### FR36 — Overage Charges
- [ ] When credits exhausted, overage pricing shown
- [ ] Or paywall re-triggers depending on implementation
- Route: generation flow

---

## Epic 5: AI Script & POV Image Generation

### FR18 — Product & Persona Selection for Generation
- [ ] Generation wizard: Step 1 = select product, Step 2 = select persona
- [ ] Only confirmed products and selected personas shown
- Route: `/generate`

### FR19 — AI Script Generation (Hook/Body/CTA)
- [ ] Script generated with Hook (3-5s), Body (5-10s), CTA (3-5s) structure
- [ ] Script reflects product description and brand tone
- [ ] 3 variants per segment type
- Route: generation progress / results

### FR20 — Composite POV Image
- [ ] Composite image of persona with product is generated
- [ ] Image visible in generation results
- Route: generation results

---

## Epic 6: Video Generation, Assembly & Delivery

### FR21 — Segmented Video Generation
- [ ] Hook, Body, CTA generated as independent segments
- [ ] Each segment < 10 seconds
- Route: generation results

### FR22 — Body Segment Splitting
- [ ] Body segments > 10s split into sub-segments
- [ ] Splits are seamless when stitched
- Route: generation results

### FR23 — Video Assembly (FFmpeg Stitching)
- [ ] User can combine any hook + body + CTA
- [ ] Stitched video plays smoothly with transitions
- [ ] Assembly costs no additional credits
- Route: `/generate/[id]`

### FR24 — 3 Variants per Segment Type
- [ ] 3 hooks, 3 bodies, 3 CTAs generated per batch
- [ ] Each variant is distinct (prompt diversity)
- [ ] 27 possible combinations
- Route: `/generate/[id]`

### FR25 — Segment Review & Combination Builder
- [ ] Segments browsable by type (hooks, bodies, CTAs)
- [ ] Combination builder lets user pick one of each
- [ ] Preview plays assembled combination
- Route: `/generate/[id]`

### FR26 — MP4 Download
- [ ] Download button on each assembled video
- [ ] Downloads as MP4 file
- [ ] No watermark on paid plans
- Route: `/generate/[id]`

---

## Epic 7: Dashboard & Video Library

### FR37 — Generation History
- [ ] History shows: timestamp, product name, persona, thumbnail
- [ ] Paginated (20 per page)
- [ ] Ordered by newest first
- Route: `/dashboard`, `/history`

### FR38 — Re-download Past Videos
- [ ] Clicking past generation shows video players
- [ ] Download buttons work with fresh signed URLs
- Route: `/generate/[id]` (past generation)
