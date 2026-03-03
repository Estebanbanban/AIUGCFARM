# Batch Export (3x3x3) Technical Audit

**Audit Date**: 2026-03-02
**Auditor**: Claude (batch-auditor)
**Task ID**: #3

---

## Executive Summary

The batch export feature is **functional but has significant production risks**:
- ✅ UI wired correctly, only shown for Triple mode
- ✅ Combo generation logic correct (all 27 combos assembled properly)
- ⚠️ **No timeout protection** - 27 sequential FFmpeg stitches = 15-45 minutes, browser tab becomes unresponsive
- ⚠️ **Memory management exists but untested** - cleanupFFmpegFiles() called between runs; WASM memory growth not measured
- ✅ Progress UI clear and detailed (shows "Stitching 5/27: hook1-body2-cta3")
- ✅ ZIP structure meaningful (videos named "combo_hook1-body2-cta3.mp4")
- 🔴 **Batch fails entirely if any combo fails** - no error recovery or skip logic
- ⚠️ **No pre-export validation** - user blindly exports all 27 without preview

---

## Detailed Findings

### 1. Is Batch Export Wired Into the UI?

**Status**: ✅ YES, properly wired

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx`

**Key Evidence**:

- **Hook used**: Line 781-782
  ```typescript
  const { batchStitch, status: batchStatus, progress: batchProgress, currentLabel: batchCurrentLabel, error: batchError, isActive: isBatching } =
    useBatchStitcher();
  ```

- **Batch Mode Toggle**: Line 776, 1409-1415
  ```typescript
  const [batchMode, setBatchMode] = useState(false);
  // UI button at line 1409:
  <Button
    variant={batchMode ? "default" : "outline"}
    size="sm"
    onClick={() => setBatchMode((m) => !m)}
  >
    <Layers className="size-4" />
    Batch Export
  </Button>
  ```

- **Export Button**: Line 1569-1594
  ```typescript
  <Button
    size="sm"
    onClick={() => batchStitch(combosToExport, generationId)}
    disabled={combosToExport.length === 0 || isBatching || combosToExport.length > 27}
  >
    {isBatching ? (
      <>
        <Loader2 className="size-3.5 animate-spin" />
        {batchStatus === "zipping"
          ? "Zipping…"
          : `Stitching ${batchProgress.current}/${batchProgress.total}…`}
      </>
    ) : batchStatus === "done" ? (
      <>
        <Check className="size-3.5" />
        Exported ✓
      </>
    ) : (
      <>
        <Layers className="size-3.5" />
        {combosToExport.length > 0
          ? `Export ${combosToExport.length} Combo${combosToExport.length !== 1 ? "s" : ""} →`
          : "Export →"}
      </>
    )}
  </Button>
  ```

- **Triple Mode Check**: Line 813
  - Skeleton count depends on mode: `gen?.mode === "triple" ? 9 : 3`
  - Batch mode UI (line 1528) conditionally renders: `{batchMode && (...)}`
  - **Not explicitly limited to triple mode** but combo generation depends on `selectedHooks`, `selectedBodies`, `selectedCtas` which are only shown when mode is triple.

---

### 2. Combo Generation Logic

**Status**: ✅ CORRECT - all 27 combos assembled properly

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx`
**Lines**: 819-840

**Implementation**:
```typescript
const combosToExport = useMemo(() => {
  if (!batchMode || !segments) return [];
  const combos: Array<{ hookUrl: string; bodyUrl: string; ctaUrl: string; label: string }> = [];
  for (const h of selectedHooks) {
    for (const b of selectedBodies) {
      for (const c of selectedCtas) {
        const hookVideo = segments.hooks?.[h];
        const bodyVideo = segments.bodies?.[b];
        const ctaVideo = segments.ctas?.[c];
        if (hookVideo && bodyVideo && ctaVideo) {
          combos.push({
            hookUrl: hookVideo.url,
            bodyUrl: bodyVideo.url,
            ctaUrl: ctaVideo.url,
            label: `hook${h + 1}-body${b + 1}-cta${c + 1}`,
          });
        }
      }
    }
  }
  return combos;
}, [batchMode, selectedHooks, selectedBodies, selectedCtas, segments]);
```

**Analysis**:
- ✅ Triple nested loop correctly generates all combinations
- ✅ For 3 hooks × 3 bodies × 3 CTAs = **27 combos**
- ✅ Each combo has `label: "hook1-body1-cta1"` format (1-indexed, human-readable)
- ✅ Safety check: `if (hookVideo && bodyVideo && ctaVideo)` ensures no null/undefined combos
- ✅ Dependency array includes all relevant state

---

### 3. Performance & Timeout Risk

**Status**: 🔴 **CRITICAL RISK** - No timeout protection

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/hooks/use-batch-stitcher.ts`
**Lines**: 31-85

**Sequential Stitching Loop** (Line 43-52):
```typescript
for (let i = 0; i < combos.length; i++) {
  const combo = combos[i];
  setCurrentLabel(combo.label);
  setProgress({ current: i, total: combos.length });

  const blob = await stitchToBlob(combo.hookUrl, combo.bodyUrl, combo.ctaUrl);
  const buffer = await blob.arrayBuffer();
  files[`combo_${combo.label}.mp4`] = new Uint8Array(buffer);

  setProgress({ current: i + 1, total: combos.length });
}
```

**Observations**:
- ✅ Combos stitched **sequentially** (one at a time, not parallel)
- ⚠️ Each `stitchToBlob()` call includes:
  - Fetching 3 videos from CDN (~5-10MB each = 15-30MB total)
  - Running FFmpeg silencedetect on each (~5-10 sec per video)
  - Trimming to speech bounds (~5 sec)
  - Concat operation (~5 sec)
  - **Estimated per-combo time: 25-60 seconds**
  - **For 27 combos: 11.25-27 minutes minimum** (up to 45 minutes with network delays)

**Issues**:
- 🔴 **No timeout/AbortController** - if any stitch hangs, entire batch hangs indefinitely
- 🔴 **No background worker** - All work on main thread → browser tab becomes unresponsive for 15-45 minutes
- 🔴 **User cannot cancel gracefully** - Only "Cancel" button visible during batch, but `batchMode && isBatching` would need explicit stop logic (line 1565, button disabled)
- ⚠️ **Network conditions not considered** - CDN fetches could add 5-20 min to total time

**Evidence**: No `navigator.sendBeacon()`, `Worker`, `SharedWorker`, or `AbortController` usage anywhere in batch-stitcher.ts.

---

### 4. Memory Management

**Status**: ⚠️ **Implemented but untested**

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/hooks/use-video-stitcher.ts`
**Lines**: 127-133, 140-188

**Cleanup Function** (Line 127-133):
```typescript
async function cleanupFFmpegFiles(ffmpeg: FFmpeg) {
  const tempFiles = ["hook.mp4", "body.mp4", "cta.mp4", "hook_t.mp4", "body_t.mp4", "cta_t.mp4", "list.txt", "output.mp4"];
  for (const f of tempFiles) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore - file may not exist */ }
  }
}
```

**Usage in stitchToBlob()** (Line 140-188):
```typescript
export async function stitchToBlob(
  hookUrl: string,
  bodyUrl: string,
  ctaUrl: string,
): Promise<Blob> {
  if (ffmpegBusy) throw new Error("FFmpeg is already in use...");
  ffmpegBusy = true;

  try {
    const [ffmpeg, { fetchFile }] = await Promise.all([
      getFFmpeg(),
      import("@ffmpeg/util"),
    ]);

    // Clean up any leftover files from a previous run
    await cleanupFFmpegFiles(ffmpeg);

    // ... stitching logic ...

    await cleanupFFmpegFiles(ffmpeg);  // Clean up after stitch
    return blob;
  } finally {
    ffmpegBusy = false;
  }
}
```

**Analysis**:
- ✅ `cleanupFFmpegFiles()` called **before** and **after** each stitch
- ✅ Temp files explicitly deleted: hook.mp4, body.mp4, cta.mp4, trimmed versions, list.txt, output.mp4
- ✅ FFmpeg singleton reused across batch (line 7): `let ffmpegSingleton: FFmpeg | null = null;`
- ✅ Mutex enforces sequential execution: `let ffmpegBusy = false;`

**Concerns**:
- ⚠️ **WASM memory growth not proven to be freed** - `deleteFile()` removes virtual FS entries, but does not guarantee WASM memory (heap) is returned to OS
- ⚠️ **Blob returned as Uint8Array copy** (Line 180): `new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" })` - This is a copy, not a reference; potential for memory duplication
- ⚠️ **No measurements taken** - No instrumentation to verify memory remains stable across 27 stitches
- **Recommendation**: Monitor peak memory usage during batch export; if it grows indefinitely, may need to reload FFmpeg singleton periodically

---

### 5. Progress UI & Feedback

**Status**: ✅ Clear and detailed

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx`
**Lines**: 1598-1616

**Progress Display**:
```typescript
{isBatching && batchStatus === "stitching" && batchProgress.total > 0 && (
  <div className="flex flex-col gap-1.5">
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
      />
    </div>
    <p className="text-xs text-muted-foreground">
      Stitching {batchProgress.current}/{batchProgress.total}
      {batchCurrentLabel && `: ${batchCurrentLabel}`}
    </p>
  </div>
)}

{batchError && (
  <p className="text-xs text-red-400">{batchError}</p>
)}
```

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/hooks/use-batch-stitcher.ts`
**Lines**: 24-28, 45-46

**State**:
```typescript
const [progress, setProgress] = useState<{ current: number; total: number }>({
  current: 0,
  total: 0,
});
const [currentLabel, setCurrentLabel] = useState<string>("");

// During stitching:
setCurrentLabel(combo.label);                    // Line 45
setProgress({ current: i, total: combos.length }); // Line 46
```

**Analysis**:
- ✅ **Progress bar** shows percentage completion (0-100%)
- ✅ **Current/total label** shows "Stitching 5/27"
- ✅ **Combo label displayed** shows "Stitching 5/27: hook1-body2-cta3"
- ✅ **Status transitions** shown in button:
  - "Stitching 5/27…" during stitch
  - "Zipping…" during ZIP creation
  - "Exported ✓" on success
- ✅ **Estimated time** (Line 1543): `formatEstimatedTime(combosToExport.length * 25)` shows user ~25-second average per combo

**Additional UI signals** (Lines 1548-1552):
```typescript
{combosToExport.length > 9 && (
  <span className="ml-1 text-amber-400">
    - Large export, stay on this tab
  </span>
)}
```

---

### 6. ZIP Structure & Naming

**Status**: ✅ Meaningful and identifiable

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/hooks/use-batch-stitcher.ts`
**Lines**: 41-52, 58-74

**ZIP Creation**:
```typescript
const files: Record<string, Uint8Array> = {};

for (let i = 0; i < combos.length; i++) {
  // ...
  files[`combo_${combo.label}.mp4`] = new Uint8Array(buffer);
  // ...
}

await new Promise<void>((resolve, reject) => {
  zip(files, { level: 0 }, (err, data) => {
    if (err) { reject(err); return; }
    const zipBlob = new Blob([data.buffer as ArrayBuffer], { type: "application/zip" });
    const url = URL.createObjectURL(zipBlob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cinerades-${generationId.slice(0, 8)}-batch-${date}.zip`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    resolve();
  });
});
```

**Analysis**:
- ✅ **Individual video naming**: `combo_hook1-body1-cta1.mp4`, `combo_hook1-body1-cta2.mp4`, etc.
- ✅ **Users can identify combos** - File name directly correlates to segment selections
- ✅ **ZIP filename** includes:
  - `cinerades-` prefix
  - Generation ID (first 8 chars) for traceability
  - `batch-` label to distinguish from other exports
  - Date (YYYY-MM-DD) for chronological sorting
  - Example: `cinerades-abc12345-batch-2026-03-02.zip`
- ✅ **Compression level**: `{ level: 0 }` (no compression, fast ZIP creation)
- ✅ **Memory cleanup**: `URL.revokeObjectURL(url)` after 10 seconds

---

### 7. Error Handling & Batch Failure Scenario

**Status**: 🔴 **All-or-nothing** - No error recovery

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/hooks/use-batch-stitcher.ts`
**Lines**: 40-82

**Current Logic**:
```typescript
try {
  const files: Record<string, Uint8Array> = {};

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    setCurrentLabel(combo.label);
    setProgress({ current: i, total: combos.length });

    const blob = await stitchToBlob(combo.hookUrl, combo.bodyUrl, combo.ctaUrl);
    // ...
  }

  setStatus("zipping");
  // ... ZIP logic ...
  setStatus("done");
} catch (err) {
  const msg = err instanceof Error ? err.message : "Batch export failed";
  setError(msg);
  setStatus("error");
}
```

**Issues**:
- 🔴 **No try/catch per combo** - If combo #5 fails, entire batch is aborted
- 🔴 **No partial ZIP creation** - User gets nothing, not 4 successful combos + error report
- 🔴 **Error message opaque** - Generic "Batch export failed" doesn't say which combo failed
- 🔴 **No retry logic** - User must re-export all 27 to try again
- 🔴 **No skip/continue option** - Can't skip the failing combo and proceed with rest

**Example Failure Scenarios**:
1. **Combo #13 fails** (CDN timeout or bad file) → All 27 combos lost
2. **Browser tab backgrounded** → Batch halts (unverified, but likely with WASM)
3. **Network drops mid-batch** → Entire export lost

**Recommendation**: Implement per-combo error handling:
```typescript
// Pseudo-code fix
const successfulCombos = [];
const failedCombos = [];

for (let i = 0; i < combos.length; i++) {
  try {
    const blob = await stitchToBlob(...);
    successfulCombos.push(...);
  } catch (err) {
    failedCombos.push({ combo: combos[i], error: err.message });
  }
}

// Create ZIP with successful combos + error report
if (successfulCombos.length > 0) {
  // Create ZIP
}
if (failedCombos.length > 0) {
  // Show warning to user
}
```

---

### 8. Pre-Export Validation & Preview

**Status**: ⚠️ **No explicit validation** - User blindly exports all 27

**File**: `/Users/estebanronsin/Sites/AIUGC/frontend/src/app/(dashboard)/generate/[id]/page.tsx`

**Current Workflow**:
1. User clicks "Batch Export" button (Line 1409-1415) → `batchMode = true`
2. User selects hooks, bodies, CTAs via checkboxes (Lines 1443-1515)
3. User sees combo count and estimated time (Lines 1534-1551)
4. User clicks "Export N Combos →" (Line 1569-1594)
5. **Batch stitches all selected combos with no preview**

**Evidence of Missing Preview**:
- No "Preview all 27" button before export
- No validation checklist
- No sample of selected combos shown to user
- User can only preview one combo at a time in the "Combination Preview" section (Lines 1625-1715), not the batch selections

**UI Signals Provided**:
- ✅ Combo count: `{combosToExport.length} combinations` (Line 1540)
- ✅ Estimated time: `formatEstimatedTime(combosToExport.length * 25)` (Line 1543)
- ⚠️ Warning if >9: "Large export, stay on this tab" (Lines 1548-1552)
- 🔴 **No preview or validation before hitting "Export"**

**Recommendation**: Add pre-export preview:
```typescript
// Show grid of 3-6 sample combos user selected
// Let user confirm: "Export 27 combos? (Hook 1, 2, 3) × (Body 1, 2, 3) × (CTA 1, 2, 3) = 27"
// Optional: Let user unselect specific combos they don't want
```

---

## Summary Table

| Audit Area | Status | Severity | File:Line | Notes |
|-----------|--------|----------|-----------|-------|
| UI Wired | ✅ | — | page.tsx:781-782, 1409-1415, 1569-1594 | Batch Export button only shown in batch mode |
| Combo Generation | ✅ | — | page.tsx:819-840 | Correct 3×3×3=27 logic with 1-indexed labels |
| Timeout Protection | 🔴 | CRITICAL | use-batch-stitcher.ts:31-85 | No AbortController, 15-45 min sequentially, main thread blocks |
| Memory Management | ⚠️ | MEDIUM | use-video-stitcher.ts:127-133, 140-188 | Cleanup implemented, WASM growth not measured |
| Progress UI | ✅ | — | page.tsx:1598-1616, use-batch-stitcher.ts:24-28 | Shows "Stitching 5/27: hook1-body2-cta3" with progress bar |
| ZIP Naming | ✅ | — | use-batch-stitcher.ts:50, 66 | Meaningful names like "combo_hook1-body2-cta3.mp4" |
| Error Recovery | 🔴 | CRITICAL | use-batch-stitcher.ts:40-82 | All-or-nothing; one failure = no ZIP, no partial results |
| Pre-Export Validation | ⚠️ | MEDIUM | page.tsx | No preview or confirmation UI before batch export |

---

## Risk Assessment

### Critical Risks (Must Fix)
1. **No timeout protection** → Browser becomes unresponsive for 15-45 minutes
2. **All-or-nothing error handling** → One failed combo = entire batch lost
3. **No pre-export preview** → Users export blindly without confirming selections

### Medium Risks (Should Fix)
1. **WASM memory growth unchecked** → Potential memory leak across 27 stitches
2. **No graceful cancel** → User stuck during batch with no way to abort

### Low Risks
1. **ZIP compression disabled** (level: 0) → Faster creation but larger file size

---

## Recommendations

### Priority 1 (Before Production)
- [ ] Add timeout per combo (~120 seconds) with graceful skip logic
- [ ] Implement per-combo error handling; create ZIP with partial results + error report
- [ ] Add pre-export preview showing sample combos user selected

### Priority 2 (Next Sprint)
- [ ] Measure WASM memory usage across 27-combo batch; reload FFmpeg if growth > 100MB
- [ ] Add background Web Worker for stitching to prevent main thread blocking
- [ ] Implement graceful cancel button with "Stop after current combo" option

### Priority 3 (Polish)
- [ ] Show user estimated time with range (e.g., "15-45 minutes depending on network")
- [ ] Add per-combo progress detail (which videos are being stitched right now)
- [ ] Create help text: "Stay on this tab during export; closing the tab will abort the batch"

---

## Conclusion

The batch export feature is **functionally complete** but has **significant production risks** around performance, error handling, and user experience. The UI is clear, progress reporting is good, and the ZIP structure is intuitive. However, the lack of timeout protection, all-or-nothing error handling, and pre-export validation make it risky for users to export large batches (27 combos = 15-45 minutes) without proper safeguards.

**Recommendation**: Implement Priority 1 fixes before releasing to production users.
