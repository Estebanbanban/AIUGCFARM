# Story 1.7: Product Library Page

Status: ready-for-dev

## Story

As an **authenticated user**,
I want to **view all my confirmed products in one place**,
So that **I can manage my product catalog and select products for video generation**.

## Acceptance Criteria

1. **Given** an authenticated user navigates to `/products`
   **When** the page loads
   **Then** all confirmed products (`confirmed = true`) are displayed in a responsive card grid
   **And** each card shows: product image (first from array, via signed URL), name, price, source badge (Shopify/Generic/Manual)
   **And** RLS ensures only the user's own products are visible

2. **Given** the user has no confirmed products
   **When** the products page loads
   **Then** an empty state is displayed with:
     - Illustration or icon
     - Message: "No products yet"
     - Two CTAs: "Import from store" (links to landing page URL input) and "Upload manually" (links to upload form)

3. **Given** the user clicks on a product card
   **When** the product detail view loads at `/products/[id]`
   **Then** all product fields are displayed: name, full description, price, all images (carousel or grid), category, brand summary (if available), source, created date
   **And** an "Edit" button allows inline editing of name, description, price
   **And** edits are saved directly to the `products` table via Supabase client (RLS permits owner updates)

4. **Given** the user wants to delete a product
   **When** they click "Delete" on the product detail page
   **Then** a confirmation dialog appears
   **And** on confirm, the product is deleted from the `products` table
   **And** the user is redirected to the products list with a success toast

5. **Given** products have images stored as storage paths in the `images` JSONB array
   **When** the frontend renders product cards
   **Then** signed URLs are generated for each image path via the Supabase client
   **And** images load correctly with proper fallback (placeholder if signed URL fails)

## Tasks / Subtasks

- [ ] Build products list page `app/(app)/products/page.tsx` (AC: 1, 2)
  - [ ] Fetch products: `supabase.from('products').select('*').eq('confirmed', true).order('created_at', { ascending: false })`
  - [ ] Render `ProductCard` grid (reuse component from Story 1.5 in display-only mode)
  - [ ] Add source badge to product cards (Shopify = blue, Generic = gray, Manual = green)
  - [ ] Empty state with CTAs
  - [ ] Loading skeleton during fetch
- [ ] Build product detail page `app/(app)/products/[id]/page.tsx` (AC: 3, 4)
  - [ ] Fetch single product by ID (RLS enforces ownership)
  - [ ] Display all fields: name, description, price, images, category, brand summary, source, date
  - [ ] Image gallery: show all images from the array
  - [ ] Inline edit mode for name, description, price
  - [ ] Save edits via `supabase.from('products').update({...}).eq('id', productId)`
  - [ ] Delete with confirmation dialog
- [ ] Create signed URL helper in `lib/storage.ts` (AC: 5)
  - [ ] `getSignedProductImageUrl(path: string)` — generates 1h signed URL from storage path
  - [ ] `getSignedProductImageUrls(paths: string[])` — batch version
  - [ ] Fallback: return placeholder image URL if signing fails
- [ ] Add "Add Product" button to products page header (AC: 1)
  - [ ] Links to manual upload form from Story 1.6
- [ ] Add product count display in page header (AC: 1)

## Dev Notes

- Product data access uses the **Supabase browser client directly** with RLS — no Edge Function needed for reads. RLS policy `auth.uid() = owner_id` ensures data isolation
- Edits and deletes also go through the Supabase client directly — RLS permits `UPDATE` and `DELETE` for `auth.uid() = owner_id`
- **Signed URLs for images:** For manually uploaded images (source = 'manual'), images are stored as storage paths in the `images` JSONB array. Use `supabase.storage.from('product-images').createSignedUrl(path, 3600)` to generate display URLs
- For scraped images (source = 'shopify' or 'generic'), the `images` array contains external URLs — display them directly with `<img>`. No signing needed
- Distinguish between storage paths and external URLs: storage paths start with `{userId}/`, external URLs start with `http`
- The product detail page is a simple CRUD view — no complex state management needed. Use React state for edit mode toggle
- This page lives under `app/(app)/` which requires auth — the layout from Story 1.6 handles the auth guard

### Project Structure Notes

```
frontend/src/
├── app/
│   └── (app)/
│       └── products/
│           ├── page.tsx              # Products list
│           └── [id]/
│               └── page.tsx          # Product detail + edit
├── components/
│   └── products/
│       └── product-card.tsx          # UPDATED — add source badge
└── lib/
    └── storage.ts                    # NEW — signed URL helpers
```

### References

- [Source: architecture.md#Row Level Security Policies — products]
- [Source: architecture.md#AD5: Signed URLs for Storage Access]
- [Source: architecture.md#Frontend Architecture — products/ pages]
- [Source: PRD#FR4 — Product review and editing]
- [Source: PRD#UJ4.2 — Returning user product management]
