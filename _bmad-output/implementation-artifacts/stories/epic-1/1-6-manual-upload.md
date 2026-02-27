# Story 1.6: Manual Product Upload

Status: ready-for-dev

## Story

As a **store owner without a website (or whose store couldn't be scraped)**,
I want to **manually upload product images and enter product details**,
So that **I can still use the platform to generate video ads**.

## Acceptance Criteria

1. **Given** an authenticated user navigates to the manual upload form
   **When** the form is displayed
   **Then** it contains fields for:
     - Product name (required, text input)
     - Description (optional, textarea)
     - Price (optional, number input with currency selector)
     - Image upload zone (at least 1 required, max 5 images)
   **And** accepted image formats are JPEG, PNG, WebP
   **And** max file size per image is 5MB

2. **Given** the user fills in the form and uploads valid images
   **When** they submit the form
   **Then** images are uploaded to the `product-images` Supabase Storage bucket at path `{user_id}/{uuid}.{ext}`
   **And** a product record is created in the `products` table with `source = 'manual'`, `confirmed = true`
   **And** the `images` JSONB array contains the storage paths (signed URLs generated on read)
   **And** `owner_id` is set to the authenticated user's ID
   **And** a success toast confirms: "Product added successfully!"
   **And** the user is redirected to the products page

3. **Given** the user tries to upload an invalid file (wrong type or > 5MB)
   **When** client-side validation runs
   **Then** the form shows an inline error message per file (e.g., "File too large. Max 5MB.")
   **And** the invalid file is not included in the upload

4. **Given** scraping returned zero products (Story 1.5 empty state)
   **When** the user clicks the "Upload manually" CTA
   **Then** they are navigated to the manual upload form

5. **Given** the user has uploaded images and sees preview thumbnails
   **When** they click the remove button on a thumbnail
   **Then** the image is removed from the pending upload list
   **And** the preview updates immediately

## Tasks / Subtasks

- [ ] Create storage migration `supabase/migrations/002_storage_buckets.sql` (AC: 2)
  - [ ] Create `product-images` bucket as private
  - [ ] Storage policy: authenticated users can INSERT to their own folder path (`auth.uid()::text = (storage.foldername(name))[1]`)
- [ ] Create `supabase/functions/upload-product/index.ts` (AC: 2, 3)
  - [ ] Accept multipart/form-data POST with fields: `name`, `description`, `price`, `currency`, and `images` (files)
  - [ ] Auth: **required** (`requireUserId`)
  - [ ] Validate each file: type must be `image/jpeg`, `image/png`, or `image/webp`; size < 5MB
  - [ ] For each valid image: generate UUID filename, upload to `product-images/{userId}/{uuid}.{ext}` via `sb.storage.from('product-images').upload()`
  - [ ] Create product record in `products` table: `source = 'manual'`, `confirmed = true`, `images = [storage_paths]`
  - [ ] Return `{ data: { product: Product } }`
- [ ] Build `components/products/manual-upload.tsx` (AC: 1, 3, 5)
  - [ ] Drag-and-drop zone using a `<label>` with hidden file input (or use a lightweight dropzone)
  - [ ] Click-to-browse fallback
  - [ ] Client-side file validation (type, size) with inline error messages per file
  - [ ] Image preview thumbnails with remove button
  - [ ] Text inputs: product name (required), description (textarea), price (number), currency (select)
  - [ ] Submit button with loading state
  - [ ] Disable submit until at least 1 image and name provided
- [ ] Add `uploadProduct()` to `lib/api.ts` (AC: 2)
  - [ ] This uses `FormData` and `multipart/form-data` Content-Type  -  different from `callEdge` JSON pattern
  - [ ] Auth token sent via `Authorization` header
- [ ] Wire manual upload CTA from scrape results empty state (AC: 4)
  - [ ] Add route: manual upload can be a modal on the landing page or a page at `/products/upload`
- [ ] Create minimal app layout `app/(app)/layout.tsx` (AC: 2)
  - [ ] Placeholder sidebar with nav links (Products, Personas, Generate, Settings)
  - [ ] Auth guard: redirect to login if unauthenticated (placeholder until Epic 2)
- [ ] Create products page `app/(app)/products/page.tsx` (AC: 2)
  - [ ] Query `products` table via Supabase client where `confirmed = true`
  - [ ] Display product cards in grid (reuse `ProductCard` from Story 1.5)
  - [ ] "Add Product" button linking to manual upload

## Dev Notes

- **Multipart form handling** in Deno Edge Functions: use `req.formData()` to parse multipart body. Each file is a `File` object with `.name`, `.type`, `.size`, `.arrayBuffer()`
- **Storage paths:** Store the relative path (`{userId}/{uuid}.ext`) in the `images` JSONB array, NOT signed URLs. Signed URLs are generated on-the-fly when the frontend requests them (via a separate helper or Edge Function). This avoids URL expiry issues in the database
- **Signed URL generation:** When displaying products, the frontend or an API call generates signed URLs from storage paths. For MVP, the products page can use Supabase client-side `createSignedUrl()`  -  but note this requires the user to be authenticated
- **Storage bucket policy** ensures users can only upload to `{auth.uid()}/` path  -  enforced at Supabase level, not just application code
- The `app/(app)/` layout is a minimal scaffold  -  full sidebar navigation will be fleshed out in Epic 2 and Epic 7
- **File upload from frontend:** Build the `FormData` object client-side, append files and text fields, send directly to the Edge Function. Do NOT base64-encode images
- **Maximum 5 images per product**  -  enforce client-side (disable upload zone after 5) and server-side (reject if > 5 files)

### Project Structure Notes

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql        # from Story 1.5
│   └── 002_storage_buckets.sql       # NEW  -  product-images bucket
└── functions/
    └── upload-product/
        └── index.ts                  # NEW

frontend/src/
├── app/
│   └── (app)/
│       ├── layout.tsx                # NEW  -  minimal app shell
│       └── products/
│           └── page.tsx              # NEW  -  product library
├── components/
│   └── products/
│       └── manual-upload.tsx         # NEW  -  upload form
└── lib/
    └── api.ts                        # UPDATED  -  add uploadProduct()
```

### References

- [Source: architecture.md#Supabase Storage Buckets  -  product-images]
- [Source: architecture.md#Storage Policies  -  product-images upload policy]
- [Source: architecture.md#Endpoints  -  upload-product/]
- [Source: architecture.md#AD5: Signed URLs for Storage Access]
- [Source: PRD#FR5  -  Manual upload fallback]
- [Source: PRD#UJ1  -  Fallback when scraping fails]
