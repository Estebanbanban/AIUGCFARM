# AIUGC  -  Agent Handoff

## What Was Being Built

**Goal:** Simplify the UX by replacing the multi-page navigation (Products → Personas → Generate) with a single unified 3-step wizard at `/generate`.

**Key change:** Instead of bouncing users between separate pages to add products and personas, everything is inline inside the wizard.

---

## New Flow Architecture

`/generate` becomes a 3-step wizard:

| Step | What it shows |
|------|--------------|
| **1  -  Product** | If products exist → product grid to pick from. If no products → inline tabs: "Import from URL" (scrape) or "Upload Manually". After adding → product grid appears, user selects one. |
| **2  -  Persona** | If personas exist → persona grid to pick from + "Create New" button. If no personas → inline full persona builder (all 9 attributes + AI image generation + image picker). After saving → auto-advance to step 3. |
| **3  -  Review & Generate** | Product + persona summary, mode selector (Single/3x), quality selector (Standard/HD), credit cost, Generate button. No more step 4. |

Nav simplification: Remove **Products** and **Personas** from sidebar. New nav: Dashboard · Generate · History · Settings.

---

## Files to Create/Modify

### 1. CREATE: `frontend/src/components/personas/PersonaBuilderInline.tsx`

A self-contained persona builder component extracted from `personas/new/page.tsx`.

**Props:**
```tsx
interface PersonaBuilderInlineProps {
  onSaved: (personaId: string) => void;  // called after select-persona-image succeeds
  onCancel?: () => void;                  // shows "Back to library" button if provided
}
```

**Behavior:**
- Same attribute UI as `personas/new/page.tsx` (gender, skin tone, age, hair color, hair style, eye color, body type, clothing style, accessories)
- Same left/right two-column layout (attributes | preview + generate button)
- `handleGenerate()` → calls `generate-persona` edge function, stores result in `usePersonaBuilderStore`
- `handleSave()` → calls `select-persona-image` edge function, then calls `onSaved(personaId)` + `store.reset()`
- Button text: "Use This Persona" instead of "Save Persona"
- No `router.push`  -  the parent handles navigation

**Uses:**
- `usePersonaBuilderStore` from `@/stores/persona-builder`
- All persona schemas from `@/schemas/persona`
- `callEdge` from `@/lib/api`
- All the same shadcn components as the original page

### 2. REWRITE: `frontend/src/app/(dashboard)/generate/page.tsx`

**Key logic changes:**
```tsx
// Product view state
const [addingProduct, setAddingProduct] = useState(false);
const [importUrl, setImportUrl] = useState('');
const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
const [showScrapeResults, setShowScrapeResults] = useState(false);
const showAddProductForm = addingProduct || (!productsLoading && confirmedProducts.length === 0);

// Persona view state
const [buildingPersona, setBuildingPersona] = useState(false);
const showPersonaBuilder = buildingPersona || (!personasLoading && activePersonas.length === 0);
```

**Step 1 render logic:**
```tsx
{showAddProductForm ? (
  showScrapeResults ? (
    <ScrapeResults onConfirmed={handleScrapeConfirmed} />
  ) : (
    <Tabs>  {/* URL import | Manual upload */}
      <ManualUploadForm onSuccess={handleManualUploadSuccess} />
    </Tabs>
  )
) : (
  <ProductGrid />  // with "Add Product" button in header
)}
```

**After scrape confirmed (`handleScrapeConfirmed`):**
```tsx
setScrapedProducts([]); setShowScrapeResults(false); setAddingProduct(false);
queryClient.invalidateQueries({ queryKey: ['products'] });
if (scrapedProducts[0]?.id) {
  store.setProductId(scrapedProducts[0].id);
  store.setStep(2);  // auto-advance
}
```

**After manual upload (`handleManualUploadSuccess`):**
```tsx
queryClient.invalidateQueries({ queryKey: ['products'] });
setAddingProduct(false);
// Don't auto-advance  -  user still needs to click the product in the grid
```

**Step 2 persona builder:**
```tsx
{showPersonaBuilder ? (
  <PersonaBuilderInline
    onSaved={(id) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] });
      store.setPersonaId(id);
      setBuildingPersona(false);
      store.setStep(3);  // auto-advance
    }}
    onCancel={activePersonas.length > 0 ? () => setBuildingPersona(false) : undefined}
  />
) : (
  <PersonaGrid />  // with "Create New" button
)}
```

**Step 3  -  merged review + generate (no step 4):**
- Same review card (product, persona, mode, quality)
- Generate button IS in this card (not a separate step)
- Steps array is `[{1, "Product"}, {2, "Persona"}, {3, "Generate"}]`
- Nav buttons: Back always, Next only on steps 1 and 2

**Removed:** Step 4 entirely. `handleGenerate` is called from the button inside Step 3.

**Imports to add:**
```tsx
import { useQueryClient } from "@tanstack/react-query";
import { ManualUploadForm } from "@/components/products/ManualUploadForm";
import { ScrapeResults } from "@/components/products/ScrapeResults";
import { PersonaBuilderInline } from "@/components/personas/PersonaBuilderInline";
import { useScrapeProduct } from "@/hooks/use-products";
import type { BrandSummary } from "@/types/database";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LinkIcon, Upload, Plus } from "lucide-react";
```

### 3. UPDATE: `frontend/src/components/layout/DashboardShell.tsx`

Remove Products and Personas entries from `navItems`:

```tsx
// BEFORE:
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products",  href: "/products",  icon: Package },   // ← REMOVE
  { label: "Personas",  href: "/personas",  icon: Users },     // ← REMOVE
  { label: "Generate",  href: "/generate",  icon: Film },
  { label: "History",   href: "/history",   icon: Clock },
  { label: "Settings",  href: "/settings",  icon: Settings },
];

// AFTER:
const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Generate",  href: "/generate",  icon: Film },
  { label: "History",   href: "/history",   icon: Clock },
  { label: "Settings",  href: "/settings",  icon: Settings },
];
```

Also remove unused imports: `Package`, `Users` from lucide-react.
Also clean up `pageTitles` (remove `/products`, `/personas`, `/personas/new` entries  -  optional).

---

## What's Already Done (No Changes Needed)

- Backend: all edge functions unchanged (`scrape-product`, `upload-product`, `generate-persona`, `select-persona-image`, `generate-video`, etc.)
- `ManualUploadForm` component  -  already exists, already wired
- `ScrapeResults` component  -  already exists, already wired
- `usePersonaBuilderStore`  -  has all methods needed
- `useScrapeProduct` hook  -  already exists
- `useQueryClient`  -  already used in products page

---

## What Still Exists (Keep As-Is)

- `/products` page  -  keep it (accessible from Settings or direct URL, acts as product library)
- `/personas` page  -  keep it (accessible from direct URL, acts as persona library)
- `/personas/new` page  -  keep it
- All history, dashboard, settings pages  -  unchanged

---

## Testing Checklist

After building:
1. Visit `/generate` with no products → should show URL/upload tabs automatically
2. Scrape a URL → ScrapeResults appear → Confirm → product grid shows, first product auto-selected, advances to step 2
3. Upload manually → product grid shows with new product → user clicks it → Next button activates
4. Step 2 with no personas → persona builder shows automatically
5. Build persona + generate images + select → "Use This Persona" → auto-advances to step 3
6. Step 2 with personas → grid shows + "Create New" button
7. Step 3 → mode/quality toggles work → Generate button fires → redirects to `/generate/[id]`
8. Sidebar shows only: Dashboard · Generate · History · Settings
9. Credits warning shows if insufficient
10. Paywall dialog appears if user clicks Generate with 0 credits

---

## Key Files Reference

```
frontend/src/
  app/(dashboard)/
    generate/page.tsx          ← REWRITE
    products/page.tsx          ← unchanged (keep as product library)
    personas/page.tsx          ← unchanged
    personas/new/page.tsx      ← unchanged
  components/
    layout/DashboardShell.tsx  ← UPDATE nav
    personas/
      PersonaBuilderInline.tsx ← CREATE
    products/
      ManualUploadForm.tsx     ← unchanged
      ScrapeResults.tsx        ← unchanged
  stores/
    persona-builder.ts         ← unchanged
    generation-wizard.ts       ← unchanged (keep 3 steps max)
  hooks/
    use-products.ts            ← unchanged
    use-personas.ts            ← unchanged
```
