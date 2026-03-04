# RAPPORT D'AUDIT FRONTEND - Flow Création & Navigation Persona

**Date:** 2026-03-02
**Audité par:** frontend-auditor
**Scope:** Création et navigation des Personas dans Next.js + Supabase

---

## 1. STRUCTURE DES ROUTES PERSONA

```
/app/(dashboard)/personas/
├── page.tsx                    # Liste des personas (PersonasPage)
├── new/
│   └── page.tsx               # Page de création (NewPersonaPage)
└── [personaId]/
    └── page.tsx               # Détail d'une persona (PersonaDetailPage)
```

### Routes URL
- `GET /personas` → Liste toutes les personas actives
- `GET /personas/new` → Page de création avec `?returnTo=/some/page` (optional)
- `GET /personas/[personaId]` → Détail d'une persona spécifique
- `GET /personas/[personaId]?edit=true` → Mode édition (non implémenté)

---

## 2. STRUCTURE DES COMPOSANTS

### PersonasPage (`/personas/page.tsx`)
- **Ligne 1-30:** Imports et types
- **Ligne 89-330:** Composant principal
  - Utilise `usePersonas()` pour charger la liste (Supabase query)
  - Utilise `useProfile()` pour les limites de slots
  - Affiche grid de cartes persona avec images résolues
  - Gère la suppression via dialog de confirmation

**Problème 1 (IMPORTANT):** Après suppression, il faut attendre `queryClient.invalidateQueries()` pour rafraîchir - mais le store persona ne se recharge pas immédiatement.

### PersonaBuilderInline (`/components/personas/PersonaBuilderInline.tsx`)
- **Ligne 1-250:** Setup initial + utilitaires SVG/image
- **Ligne 571-1200:** Composant principal
  - Mode "Quick" (AI génère à partir d'une description) : **Ligne 671-729**
  - Mode "Custom" (sélection manuelle des attributs) : **Ligne 731-1010**
  - Deux boutons: "Generate from description" et "Generate with custom settings"
  - Deux appels d'edge function: `generate-persona` (x2 for quick mode), puis `select-persona-image`

**Props:**
```typescript
interface PersonaBuilderInlineProps {
  onSaved: (personaId: string) => void;  // Callback après sauvegarde
  onCancel?: () => void;                 // Callback pour retour
}
```

### NewPersonaPage (`/personas/new/page.tsx`)
- **Ligne 500-550:** Configuration + limites de slots
- **Ligne 643-670:** `handleSave()` → appelle edge function `select-persona-image`
  - **Ligne 655:** Redirection après succès: `router.push(returnTo || "/personas")`

### PersonaDetailPage (`/personas/[personaId]/page.tsx`)
- **Ligne 127-461:** Composant principal
- **Ligne 132-142:** Chargement via `usePersona(personaId)` hook
  - **Ligne 26-41 dans use-personas.ts:**
    ```typescript
    export function usePersona(id: string) {
      return useQuery<Persona>({
        queryKey: ["personas", id],
        queryFn: async () => {
          const supabase = createClient();
          const { data, error } = await supabase
            .from("personas")
            .select("*")
            .eq("id", id)
            .single();  // ← ATTENTION: retourne une erreur si pas trouvée
          if (error) throw new Error(error.message);
          return data;
        },
        enabled: !!id,
      });
    }
    ```

- **Ligne 196-223:** Page "Persona not found" si `personaError || !persona`

---

## 3. FLOW EXACT DE CRÉATION (Step by Step)

### Étape 1: Navigation vers `/personas/new`
```
User clique "Create Persona" → router.push("/personas/new")
```

### Étape 2: Mode Selection (Quick vs Custom)
```
PersonaBuilderInline affiche deux onglets:
  1. Quick Mode: "Describe your persona" + "Generate from description"
  2. Custom Mode: Sélectionne Gender, Ethnicity, Age, Hair, Body, Clothing, Accessories
```

### Étape 3a: Quick Mode Generation
```
User rentre nom + description
User clique "Generate from description"
  ↓
callEdge("generate-persona", {
  body: {
    name: "Sophie",
    description: "28-year-old Black woman...",
    image_count: 1  // ← First image only
  }
})
  ↓
Edge Function:
  1. Parse description → attributes via OpenRouter
  2. Validate attributes
  3. Generate image via NanoBanana
  4. INSERT persona into DB
  5. Return: { data: { id: "uuid-123", generated_image_urls: [...] } }
  ↓
Frontend:
  - store.setPersonaId("uuid-123")
  - store.setGeneratedImages(urls1)
  ↓
Call 2 (ASYNC, no wait):
  - Generate second image with image_count=1
  - Update store with both images
  - If fails, still OK (we have first image)
```

### Étape 3b: Custom Mode Generation
```
User sélectionne tous les attributs
User clique "Generate with custom settings"
  ↓
callEdge("generate-persona", {
  body: {
    name: "Marcus",
    attributes: {
      gender: "male",
      ethnicity: "Black / African",
      age: "25_35",
      hair_color: "Black",
      hair_style: "Short Curly",
      eye_color: "Brown",
      body_type: "athletic",
      clothing_style: "Streetwear",
      accessories: ["Watch"]
    },
    // NO persona_id → CREATE new
    image_count: 2  // ← Full count
  }
})
  ↓
Edge Function (same as Quick):
  1. Validate attributes
  2. Generate scene prompt via OpenRouter
  3. Generate 2 images via NanoBanana
  4. Upload to persona-images bucket
  5. Sign URLs
  6. INSERT persona, return ID + signed URLs
  ↓
Frontend:
  - store.setPersonaId(result.id)
  - store.setGeneratedImages(signedUrls)
```

### Étape 4: Selection de l'Image
```
User voit 2 (ou 1) images générées
User clique une image → store.selectImage(index)
  ↓
Image affichée avec ring-primary
```

### Étape 5: Save
```
User clique "Save Persona"
  ↓
callEdge("select-persona-image", {
  body: {
    persona_id: "uuid-123",
    image_index: 0  // L'image sélectionnée
  }
})
  ↓
Edge Function:
  1. Fetch persona by ID (verify ownership)
  2. UPDATE selected_image_url = generated_images[0]
  3. Generate signed URL
  4. Return: { data: { persona_id, selected_image_url, signed_url } }
  ↓
Frontend:
  - toast.success("Persona saved!")
  - store.reset()
  - router.push(returnTo || "/personas")  ← CRITICAL REDIRECT
```

### Étape 6: Redirection vers `/personas/[id]`
```
router.push("/personas/123")
  ↓
PersonaDetailPage mounts
  ↓
usePersona("123") runs:
  - queryKey: ["personas", "123"]
  - Supabase query: SELECT * FROM personas WHERE id = "123" LIMIT 1
  - If found: display persona
  - If NOT found: show "Persona not found" (Ligne 197-223)
```

---

## 4. OÙ SE PRODUIT LE "NOT FOUND"

### Issue: Timeout ~101 secondes → "Persona not found"

**Localisation exacte:**
- **Ligne 197 dans `/personas/[personaId]/page.tsx`:**
  ```typescript
  if (personaError || !persona) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/personas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            Persona not found    ← ICI LE MESSAGE "NOT FOUND"
          </h1>
        </div>
        ...
      </div>
    );
  }
  ```

### Timing (~101 secondes):
1. **~0-3 sec:** User saves persona → `select-persona-image` API call succeeds
2. **~3-5 sec:** Frontend redirects to `/personas/[id]`
3. **~5-101 sec:** `usePersona()` query retries or fails
   - Supabase `.single()` throws error if row not found
   - React Query has default retry logic (3 retries × ~30 sec each = ~90 sec)
   - After all retries exhaust, `personaError` is set
4. **~101 sec:** Component renders "Persona not found"

---

## 5. INCOHÉRENCES ENTRE LES PAGES

### Incohérence 1: PersonaBuilderInline vs DetailPage affichent différents champs

**PersonaBuilderInline affiche (Ligne 877-1010):**
- Gender (Ligne 877-890)
- Ethnicity (Ligne 892-906)
- Age Range (Ligne 908-920)
- Hair Color (Ligne 922-936)
- Hair Style (Ligne 938-952)
- Eye Color (Ligne 954-968)
- Body Type (Ligne 970-984)
- Clothing Style (Ligne 986-998)
- Accessories (Ligne 1000-1010)

**DetailPage affiche (Ligne 342-376):**
- Gender, Age, Hair Color, Hair Style, Eye Color, Body Type, Clothing Style
- **MANQUANT:** Ethnicity/Skin Tone
- **MANQUANT:** Accessories

**Bug:** L'ethnicity est stockée en DB mais ne s'affiche pas sur la page détail!
- **Ligne 73-82 dans DetailPage:**
  ```typescript
  function buildAttributeList(attrs: PersonaAttributes) {
    return [
      { label: "Gender", value: attrs.gender },
      { label: "Age Range", value: attrs.age },
      { label: "Hair Color", value: attrs.hair_color },
      { label: "Hair Style", value: attrs.hair_style },
      { label: "Eye Color", value: attrs.eye_color },
      { label: "Body Type", value: attrs.body_type },
      { label: "Clothing Style", value: attrs.clothing_style },
      // MISSING: ethnicity, skin_tone, accessories
    ].filter((a) => a.value);
  }
  ```

- **Ligne 361-374:** Accessories ARE displayed!
  ```typescript
  {accessories.length > 0 && (
    <div className="mt-4">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        Accessories
      </span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {accessories.map((acc) => (
          <Badge key={acc} variant="outline" className="text-xs">
            {acc}
          </Badge>
        ))}
      </div>
    </div>
  )}
  ```

### Incohérence 2: Ethnicity not in buildAttributeList

**Data exists in DB** (stored by `generate-persona`):
```typescript
attributes: {
  gender: "female",
  ethnicity: "Black / African",  ← Stored
  age: "25_35",
  hair_color: "Dark Brown",
  ...
}
```

**But DetailPage doesn't show it** (missing from buildAttributeList):
```typescript
const attrs = persona.attributes;
const attributes = buildAttributeList(attrs);  ← ethnicity filtered out
```

---

## 6. BUGS TROUVÉS AVEC NUMÉRO DE LIGNE

### BUG #1: Ethnicity manquant dans Detail Page
- **Fichier:** `/app/(dashboard)/personas/[personaId]/page.tsx`
- **Ligne:** 73-82
- **Severité:** MEDIUM (data loss in UI)
- **Description:** `buildAttributeList()` n'inclut pas `ethnicity` ni `skin_tone`
- **Impact:** L'ethnicity sélectionnée dans le builder n'est pas affichée sur la page de détail
- **Fix:** Ajouter `{ label: "Ethnicity", value: attrs.ethnicity || attrs.skin_tone }`

### BUG #2: Timeout lors du chargement après création
- **Fichier:** `/app/(dashboard)/personas/[personaId]/page.tsx`
- **Ligne:** 132-142 (usePersona hook)
- **Severité:** HIGH (UX - ~101 sec wait)
- **Description:** React Query retries `usePersona()` plusieurs fois (par défaut 3 retries)
- **Root Cause:**
  1. `select-persona-image` peut être lent (~2-5 sec)
  2. Persona peut ne pas être immédiatement visible après l'INSERT
  3. Supabase `.single()` retourne erreur
  4. React Query retry par défaut: exponential backoff
- **Impact:** User voit "Persona not found" après ~101 secondes (3 retries × ~30 sec RLS timeout)
- **Fix:** Ajouter `retry: false` ou réduire `retryDelay` dans `useQuery()`

### BUG #3: Race condition dans Quick Mode (PersonaBuilderInline)
- **Fichier:** `/components/personas/PersonaBuilderInline.tsx`
- **Ligne:** 694-720
- **Severité:** MEDIUM (second image generation not awaited)
- **Description:**
  ```typescript
  // Call 2: generate second portrait using same persona_id + attributes
  setIsGeneratingSecond(true);  ← Flag set
  try {
    const result2 = await callEdge<...>('generate-persona', {...});  ← AWAITED
    // ...
  } catch (err2) {
    console.warn('Second portrait generation failed:', err2);  ← Logged, ignored
  } finally {
    setIsGeneratingSecond(false);  ← Flag cleared
  }
  ```
- **Issue:** If second image fails, `setIsGeneratingSecond(false)` runs but UI might show loading state inconsistently
- **Impact:** Second portrait might fail silently; user sees only 1 image instead of 2
- **Fix:** Move `setIsGeneratingSecond()` logic to useEffect + Promise.allSettled

### BUG #4: Potential RLS issue in select-persona-image
- **Fichier:** `/supabase/functions/select-persona-image/index.ts`
- **Ligne:** 28-39
- **Severité:** LOW (defensive, but explicit ownership check is good)
- **Description:** Persona fetch doesn't apply RLS filter explicitly (relies on user context)
- **Current code:**
  ```typescript
  const { data: persona, error: fetchErr } = await sb
    .from("personas")
    .select("id, owner_id, generated_images")
    .eq("id", persona_id)
    .single();

  if (fetchErr || !persona) {
    return json({ detail: "Persona not found" }, cors, 404);
  }
  if (persona.owner_id !== userId) {
    return json({ detail: "Persona not found" }, cors, 404);
  }
  ```
- **Good:** Explicit `owner_id !== userId` check (defense in depth)
- **Could be better:** Could add `.eq("owner_id", userId)` to query for clarity

### BUG #5: Inconsistent error handling in New Page
- **Fichier:** `/app/(dashboard)/personas/new/page.tsx`
- **Ligne:** 540-545 (redirect guard)
- **Severité:** LOW (logic works, but could be clearer)
- **Description:**
  ```typescript
  useEffect(() => {
    if (!profile || !personas || isRegeneration) return;
    const plan = profile.plan ?? "free";
    const isAdmin = profile.role === "admin";
    const slotLimit = PERSONA_SLOT_LIMITS[plan];
    const slotsUsed = personas.length;
    if (!isAdmin && slotsUsed >= slotLimit) {
      toast.error("You've reached your persona limit. Upgrade to create more.");
      router.push("/personas");  ← Immediate redirect
    }
  }, [profile, personas, isRegeneration, router]);
  ```
- **Issue:** Toast is shown but user is redirected immediately; they might not see it
- **Fix:** Add `await new Promise(resolve => setTimeout(resolve, 500))` before redirect

### BUG #6: Store persistence issue on quick-create failure
- **Fichier:** `/components/personas/PersonaBuilderInline.tsx`
- **Ligne:** 723-728
- **Severité:** LOW (minor UX issue)
- **Description:**
  ```typescript
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate persona';
    toast.error(msg);
  } finally {
    setIsGeneratingQuick(false);  ← But store state not reset!
  }
  ```
- **Issue:** If generation fails, `store.personaId` and `store.generatedImages` might be partially set
- **Impact:** User can retry but state is inconsistent
- **Fix:** Reset store state in catch block

---

## 7. FIXES RECOMMANDÉS

### CRITICAL (Déployer ASAP)
1. **Fix usePersona() retry logic**
   - Ajouter `retry: false` dans `/hooks/use-personas.ts:26-41`
   - Ou définir `retryDelay: () => 100` pour réduire les délais

2. **Ajouter ethnicity à buildAttributeList**
   - Modifier `/personas/[personaId]/page.tsx:73-82`
   - Ajouter ligne: `{ label: "Ethnicity", value: attrs.ethnicity ?? attrs.skin_tone }`

### IMPORTANT (Prochaine sprint)
3. **Améliorer error handling en Quick Mode**
   - Refactoriser seconde generation avec Promise.allSettled
   - Afficher le nombre d'images générées vs. attendues

4. **Ajouter debounce sur redirect après erreur de limite**
   - `/personas/new/page.tsx:540-545`

### NICE-TO-HAVE (Future)
5. **Ajouter back button depuis Detail Page avec confirmation si en cours d'édition**
   - Cas: User clique "Edit & Regenerate" mais change d'avis

6. **Persist last error state dans QueryClient**
   - Pour afficher un replay bouton si usePersona() fails

---

## 8. SCHÉMA DE REQUÊTES SUPABASE

### Requête 1: List Personas
```sql
SELECT * FROM personas
WHERE owner_id = $1 AND is_active = true
ORDER BY created_at DESC
```
- Hook: `usePersonas()` (ligne 10-24)
- Timing: ~200-500ms (batch signing URLs adds overhead)

### Requête 2: Get Single Persona
```sql
SELECT * FROM personas
WHERE id = $1 LIMIT 1
```
- Hook: `usePersona(id)` (ligne 26-41)
- Timing: ~100-200ms (or fails if not found → retry loop)
- **PROBLÈME:** Aucun timeout explicite, juste retry par défaut (peut = 101 sec)

### Requête 3: Check Persona Slots
```sql
SELECT COUNT(*) FROM personas
WHERE owner_id = $1 AND is_active = true
```
- Appel direct dans generate-persona (ligne 460-465 dans edge function)
- Timing: ~100ms

### Requête 4: Insert Persona (après génération)
```sql
INSERT INTO personas (owner_id, name, attributes, generated_images, selected_image_url, is_active, regen_count)
VALUES ($1, $2, $3, $4, NULL, true, 1)
RETURNING id, name, attributes, generated_images, selected_image_url, regen_count
```
- Edge function: `generate-persona` (ligne 582-597)
- Timing: ~200-400ms
- **Retour:** `persona.id` utilisé pour la redirection

### Requête 5: Update Selected Image
```sql
UPDATE personas
SET selected_image_url = $1
WHERE id = $2 AND owner_id = $3
```
- Edge function: `select-persona-image` (ligne 54-58)
- Timing: ~100-200ms
- **Impact:** Après succès, redirection -> `/personas/[id]` -> usePersona() retry loop

---

## 9. FLOW COMPLET AVEC TIMING

```
┌─────────────────────────────────────────────────────────────────────┐
│                     CRÉATION D'UNE PERSONA                           │
└─────────────────────────────────────────────────────────────────────┘

User click "Create Persona"
    │
    ├─→ Navigate to /personas/new [~50ms]
    │
    ├─→ New Page: Check slot limits
    │   ├─ useProfile() query
    │   ├─ usePersonas() query
    │   ├─ If at limit: toast + redirect to /personas [~500ms]
    │   └─ Else: show builder
    │
    ├─→ User fills Quick Description + clicks Generate [~3sec]
    │   │
    │   ├─ callEdge("generate-persona", { description, name, image_count: 1 })
    │   │   ├─ OpenRouter: Parse description [~5-10sec]
    │   │   ├─ NanoBanana: Generate 1 image [~10-30sec]
    │   │   ├─ Upload to storage [~1-2sec]
    │   │   ├─ DB INSERT persona [~200ms]
    │   │   └─ Return: { id: "uuid-123", generated_image_urls: [...] }
    │   │
    │   └─ Frontend: store.setPersonaId("uuid-123") [~50ms]
    │
    ├─→ ASYNC: Second image generation [happens in background]
    │   ├─ callEdge("generate-persona", { persona_id: "uuid-123", image_count: 1 })
    │   ├─ NanoBanana: Generate 1 image [~10-30sec]
    │   └─ DB UPDATE generated_images [~200ms]
    │
    ├─→ User selects one of 2 images
    │   └─ store.selectImage(index)
    │
    ├─→ User clicks "Save Persona" [~3sec total]
    │   │
    │   ├─ callEdge("select-persona-image", { persona_id: "uuid-123", image_index: 0 })
    │   │   ├─ DB UPDATE selected_image_url [~200ms]
    │   │   ├─ Generate signed URL [~100ms]
    │   │   └─ Return success
    │   │
    │   ├─ toast.success("Persona saved!")
    │   ├─ store.reset()
    │   └─ router.push("/personas/123") [~100ms]
    │
    └─→ Navigate to /personas/[personaId] [TIMING ISSUE HERE]
        │
        ├─ PersonaDetailPage mounts [~50ms]
        │
        ├─ usePersona("123") runs
        │   ├─ Query 1: SELECT * FROM personas WHERE id = "123"
        │   │   ├─ If found: Return data [~200ms] ✓
        │   │   └─ If NOT found: Error, set personaError
        │   │
        │   ├─ Retry 1 after ~30sec: Still not found
        │   ├─ Retry 2 after ~60sec: Still not found
        │   └─ Retry 3 after ~90sec: Fail completely
        │
        └─ Display "Persona not found" [~101sec from start]

BUG: Why persona not found after INSERT?
  - Possible: SELECT issued before INSERT committed
  - Possible: Replication lag between write region + read region
  - Possible: RLS policy timing issue
```

---

## 10. SCHÉMA DES DONNÉES

```typescript
interface Persona {
  id: string;                          // UUID
  owner_id: string;                    // User ID
  name: string;                        // "Sophie"
  attributes: PersonaAttributes;       // JSON object
  generated_images: string[];          // Storage paths: ["user-id/uuid-1.jpg", ...]
  selected_image_url: string | null;   // Storage path of chosen image
  is_active: boolean;                  // true = not deleted
  regen_count: number;                 // Number of regenerations (free tier limit)
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
}

interface PersonaAttributes {
  gender: string;                      // "female"
  ethnicity?: string;                  // "Black / African"
  skin_tone?: string;                  // Legacy, hex code or text
  age: string;                         // "25_35"
  hair_color: string;                  // "Dark Brown"
  hair_style: string;                  // "Medium Straight"
  eye_color: string;                   // "Brown"
  body_type: string;                   // "average"
  clothing_style: string;              // "Casual"
  accessories: string[];               // ["Watch", "Necklace"]
  scene_prompt?: string;               // Generated UGC scene description
}
```

---

## 11. CONCLUSION

### Résumé des Problèmes

1. **CRITICAL:** Timeout ~101 sec après création d'une persona
   - Cause: React Query retry logic de `usePersona()`
   - Solution: Désactiver retries ou réduire les délais

2. **IMPORTANT:** Ethnicity manquant dans la vue détail
   - Cause: `buildAttributeList()` ne l'inclut pas
   - Solution: 1 ligne de code à ajouter

3. **MEDIUM:** Incohérence entre création et détail
   - Cause: Pages construisent indépendamment la liste des attributs
   - Solution: Refactoriser en composant partagé

4. **MEDIUM:** Quick Mode peut générer 1 image au lieu de 2 silencieusement
   - Cause: Seconde génération non attendue
   - Solution: Meilleure gestion des erreurs asynchrones

### Recommandations Immédiates
1. Fix `usePersona()` pour éviter timeout
2. Ajouter ethnicity à DetailPage
3. Test E2E du flow complet création → détail
4. Vérifier les logs Supabase pour delays en réplication

---

## APPENDIX A: Fichiers auditées

```
✓ /frontend/src/app/(dashboard)/personas/page.tsx          [330 lignes]
✓ /frontend/src/app/(dashboard)/personas/new/page.tsx      [1200+ lignes]
✓ /frontend/src/app/(dashboard)/personas/[personaId]/page.tsx [461 lignes]
✓ /frontend/src/components/personas/PersonaBuilderInline.tsx [1400+ lignes]
✓ /frontend/src/hooks/use-personas.ts                      [171 lignes]
✓ /frontend/src/stores/persona-builder.ts                  [149 lignes]
✓ /supabase/functions/generate-persona/index.ts            [631 lignes]
✓ /supabase/functions/select-persona-image/index.ts        [86 lignes]
```

---

**Fin du rapport**
