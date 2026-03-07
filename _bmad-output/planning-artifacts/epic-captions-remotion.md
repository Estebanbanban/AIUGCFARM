# Epic: Remotion Dynamic Subtitles

**Status:** Planned
**Owner:** engineering
**Last updated:** 2026-03-07
**Supersedes:** The CSS/rAF caption overlay in `epic-captions.md` Phase 1

---

## Context

The current caption overlay (CSS + requestAnimationFrame loop, shipped Phase 1) works but is fragile — three separate video refs, manual offset math, and tight coupling to `currentSegment` state. Word timing is estimated by distributing segment duration evenly across words.

Remotion's `@remotion/captions` package provides `createTikTokStyleCaptions()`, which takes an array of `Caption` objects and produces paginated caption pages with per-token active state — exactly what CapCut-style captions require. Combined with `@remotion/player`'s `<Player>` component, we can embed a declarative, frame-accurate caption renderer directly in the existing Next.js video player.

**Key insight:** Kling videos have no audio. Script text + `duration_seconds` in the DB is the source of truth. We construct `Caption[]` from `GenerationScript` with evenly distributed word timing — no Whisper/ASR required.

---

## Architecture

### Caption Data Flow

```
GenerationScript (from DB)
  hooks[i].text + duration_seconds
  bodies[i].text + duration_seconds
  ctas[i].text + duration_seconds
        ↓
buildCaptionsFromScript()
  → Caption[] (one Caption per word, startMs/endMs derived from duration)
        ↓
createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 200 })
  → { pages: TikTokPage[] }
        ↓
<Player component={CaptionOverlay} inputProps={{ pages }} durationInFrames fps />
  → renders active token highlighted, inactive tokens white
```

### Key Types (from `@remotion/captions`)

```ts
interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number;     // same as startMs
  confidence: number | null;
}

interface TikTokPage {
  text: string;
  startMs: number;
  durationMs: number;
  tokens: Array<{ text: string; fromMs: number; toMs: number }>;
}
```

### Component Architecture

```
VideoSegmentCard
  └─ <video> ref (existing)
  └─ CaptionPlayerOverlay  (new — absolute positioned on top of video)
       └─ <Player component={CaptionComposition} .../>
            └─ CaptionComposition (Remotion composition)
                 └─ pages.map(page => <Sequence from durationInFrames>)
                      └─ <CaptionPage page currentFrame fps />
                           └─ page.tokens.map(token => highlighted or plain span)

CombinationPreview
  └─ (same pattern, single Player across all 3 segments)
```

---

## Stories

### Story R1 — Install packages + build caption factory utility

**Packages:**
```bash
bun add @remotion/player @remotion/captions
```

No full Remotion CLI needed. `@remotion/player` is a React component that works in any Next.js app. `@remotion/captions` is a pure utility library.

**New file: `frontend/src/lib/captions.ts`**

```ts
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import type { GenerationScript, ScriptSegment } from "@/types/generation";

/**
 * Convert a GenerationScript segment array into Remotion Caption objects.
 * Distributes each segment's duration evenly across its words.
 */
function segmentToCaptions(segments: ScriptSegment[], offsetMs: number): Caption[] {
  const captions: Caption[] = [];
  let cursorMs = offsetMs;

  for (const seg of segments) {
    const totalMs = seg.duration_seconds * 1000;
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      cursorMs += totalMs;
      continue;
    }
    const msPerWord = totalMs / words.length;
    for (let i = 0; i < words.length; i++) {
      const startMs = cursorMs + i * msPerWord;
      captions.push({
        text: words[i],
        startMs,
        endMs: startMs + msPerWord,
        timestampMs: startMs,
        confidence: null,
      });
    }
    cursorMs += totalMs;
  }

  return captions;
}

export interface CaptionPages {
  pages: ReturnType<typeof createTikTokStyleCaptions>["pages"];
  totalDurationMs: number;
}

/**
 * Build TikTok-style caption pages from a single script segment array.
 * Used by VideoSegmentCard (single segment).
 */
export function buildSingleSegmentCaptions(
  segments: ScriptSegment[],
): CaptionPages {
  const captions = segmentToCaptions(segments, 0);
  const totalDurationMs = segments.reduce((acc, s) => acc + s.duration_seconds * 1000, 0);
  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 200,
  });
  return { pages, totalDurationMs };
}

/**
 * Build TikTok-style caption pages from the full combination (hook + body + cta).
 * Used by CombinationPreview.
 */
export function buildComboCaptions(
  hookSegments: ScriptSegment[],
  bodySegments: ScriptSegment[],
  ctaSegments: ScriptSegment[],
): CaptionPages {
  const hookMs = hookSegments.reduce((a, s) => a + s.duration_seconds * 1000, 0);
  const bodyMs = bodySegments.reduce((a, s) => a + s.duration_seconds * 1000, 0);
  const ctaMs  = ctaSegments.reduce((a, s) => a + s.duration_seconds * 1000, 0);

  const captions = [
    ...segmentToCaptions(hookSegments, 0),
    ...segmentToCaptions(bodySegments, hookMs),
    ...segmentToCaptions(ctaSegments, hookMs + bodyMs),
  ];

  const { pages } = createTikTokStyleCaptions({
    captions,
    combineTokensWithinMilliseconds: 200,
  });

  return { pages, totalDurationMs: hookMs + bodyMs + ctaMs };
}
```

**Acceptance criteria:**
- `bun add @remotion/player @remotion/captions` succeeds
- `buildSingleSegmentCaptions` and `buildComboCaptions` are exported and typed
- Unit test: 3-word segment, 3s duration → 3 captions at 0ms/1000ms/2000ms each

---

### Story R2 — Build `CaptionComposition` Remotion component

**New file: `frontend/src/components/captions/CaptionComposition.tsx`**

This is the Remotion composition — rendered inside a `<Player>`. It receives `pages: TikTokPage[]` as `inputProps` and renders the currently active caption page with per-token highlighting.

```tsx
"use client";

import { useCurrentFrame, useVideoConfig, Sequence, AbsoluteFill } from "remotion";
import type { TikTokPage } from "@remotion/captions";

interface Props {
  pages: TikTokPage[];
}

export function CaptionComposition({ pages }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentMs = (frame / fps) * 1000;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {pages.map((page, i) => {
        const startFrame = Math.floor((page.startMs / 1000) * fps);
        const durationFrames = Math.ceil((page.durationMs / 1000) * fps);

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <CaptionPage page={page} currentMs={currentMs} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

function CaptionPage({ page, currentMs }: { page: TikTokPage; currentMs: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 4px",
        padding: "6px 12px",
        borderRadius: 8,
        backgroundColor: "rgba(0,0,0,0.75)",
        maxWidth: "90%",
      }}
    >
      {page.tokens.map((token, i) => {
        const isActive = currentMs >= token.fromMs && currentMs < token.toMs;
        return (
          <span
            key={i}
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 15,
              fontWeight: "bold",
              color: isActive ? "#FACC15" : "#FFFFFF", // yellow-400 / white
              lineHeight: 1.4,
            }}
          >
            {token.text}
          </span>
        );
      })}
    </div>
  );
}
```

**Notes:**
- `AbsoluteFill` fills the Player canvas. `pointerEvents: none` so the real `<video>` below receives clicks.
- `<Sequence>` mounts/unmounts each page at the correct frame — Remotion handles this declaratively; no manual visibility logic needed.
- `currentMs` is derived from `frame / fps * 1000`, which Remotion updates per-frame.

**Acceptance criteria:**
- Component renders without errors in isolation with mock pages
- Active token turns yellow; adjacent tokens remain white
- No tokens visible outside their page's time window

---

### Story R3 — `CaptionPlayerOverlay` wrapper component

**New file: `frontend/src/components/captions/CaptionPlayerOverlay.tsx`**

Wraps `<Player>` and positions it absolutely over the existing `<video>` element. The Player has a transparent background and `pointerEvents: none` so it's purely visual.

```tsx
"use client";

import { Player } from "@remotion/player";
import { CaptionComposition } from "./CaptionComposition";
import type { TikTokPage } from "@remotion/captions";

interface Props {
  pages: TikTokPage[];
  totalDurationMs: number;
  /** Width/height of the underlying <video> element in pixels */
  width: number;
  height: number;
  /** The underlying <video> element, used to sync currentTime */
  videoRef: React.RefObject<HTMLVideoElement>;
}

const FPS = 30;

export function CaptionPlayerOverlay({ pages, totalDurationMs, width, height, videoRef }: Props) {
  const durationInFrames = Math.max(1, Math.ceil((totalDurationMs / 1000) * FPS));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <Player
        component={CaptionComposition}
        inputProps={{ pages }}
        durationInFrames={durationInFrames}
        fps={FPS}
        compositionWidth={width}
        compositionHeight={height}
        style={{ width: "100%", height: "100%", background: "transparent" }}
        // Sync Player time to the video element's currentTime
        // via the imperative Player API
        ref={(player) => {
          if (!player || !videoRef.current) return;
          const video = videoRef.current;
          const onTimeUpdate = () => {
            const targetFrame = Math.floor(video.currentTime * FPS);
            player.seekTo(targetFrame);
          };
          video.addEventListener("timeupdate", onTimeUpdate);
          return () => video.removeEventListener("timeupdate", onTimeUpdate);
        }}
      />
    </div>
  );
}
```

**Note on Player sync:** `<Player>` has an imperative `seekTo(frame)` API. We listen to the underlying `<video>`'s `timeupdate` event and push the current frame to the Player — keeping captions in sync with actual video playback without managing our own rAF loop.

**Acceptance criteria:**
- Overlay renders on top of video without blocking clicks on video controls
- Caption text appears at correct video timestamp
- No caption text visible when video hasn't started

---

### Story R4 — Integrate into `VideoSegmentCard`

**Target file:** `frontend/src/app/(dashboard)/generate/[id]/page.tsx`

Replace the current `captionsOn` CSS overlay logic in `VideoSegmentCard` with `CaptionPlayerOverlay`.

**Changes:**
1. Remove: `captionCues` useMemo, `timeupdate` effect for word sync, `activeWordIdx` state, inline caption overlay JSX
2. Add: `import { buildSingleSegmentCaptions } from "@/lib/captions"` and `import { CaptionPlayerOverlay } from "@/components/captions/CaptionPlayerOverlay"`
3. Add: `captionData = useMemo(() => scriptText ? buildSingleSegmentCaptions([{ text: scriptText, duration_seconds: video.duration }]) : null, [scriptText, video.duration])`
4. Replace caption overlay JSX:

```tsx
{captionsOn && captionData && (
  <CaptionPlayerOverlay
    pages={captionData.pages}
    totalDurationMs={captionData.totalDurationMs}
    width={video.width ?? 480}
    height={video.height ?? 854}
    videoRef={videoRef}
  />
)}
```

**Acceptance criteria:**
- CC button toggles caption overlay on/off
- Active word highlights yellow during playback
- No visual regression on VideoSegmentCard layout

---

### Story R5 — Integrate into `CombinationPreview`

**Target file:** `frontend/src/app/(dashboard)/generate/[id]/page.tsx`

Replace the `CombinationPreview` rAF caption logic with a single `CaptionPlayerOverlay` that spans the full stitched duration.

**Challenge:** `CombinationPreview` plays 3 sequential `<video>` elements (hookRef, bodyRef, ctaRef), not one. The Remotion Player needs a single global time.

**Approach:** Maintain a `globalTimeS` ref (updated via rAF) that accumulates time from completed segments. On each rAF tick, compute `globalTimeMs = completedSegmentsMs + activeVideo.currentTime * 1000`. Use this to drive a single hidden Remotion `<Player>` with the combined caption pages.

Alternatively (simpler): When the user clicks the stitch play button, create a synthetic `<video>` or just use `playerRef.seekTo(frame)` driven by the same rAF loop that already exists for segment switching.

**Revised approach using Player imperative API:**

```tsx
const playerRef = useRef<PlayerRef>(null);

// Existing rAF loop extended:
const tick = () => {
  // ... existing segment switch logic ...
  const completedMs = /* sum of durations of segments before currentSegment */;
  const activeVideo = [hookRef, bodyRef, ctaRef][currentSegment]?.current;
  const globalMs = completedMs + (activeVideo?.currentTime ?? 0) * 1000;
  const frame = Math.floor((globalMs / 1000) * 30);
  playerRef.current?.seekTo(frame);
  rafRef.current = requestAnimationFrame(tick);
};
```

**Changes:**
1. Remove: existing `captionCues` useMemo, `captionActiveIdx` state, inline caption overlay JSX
2. Add: `buildComboCaptions` call using `hookScript`, `bodyScript`, `ctaScript` segments
3. Add: `<CaptionPlayerOverlay>` with `playerRef` forwarded for imperative control

**Acceptance criteria:**
- Captions remain in sync as the stitched video transitions from hook → body → cta
- CC button in CombinationPreview toggles the overlay
- No duplicate caption overlays visible

---

### Story R6 — Style presets (optional, post-MVP)

Expose a `style` prop on `CaptionComposition`:

```ts
type CaptionStyle = "default" | "tiktok-bold" | "minimal";

const STYLES: Record<CaptionStyle, React.CSSProperties> = {
  "default":     { fontSize: 15, fontWeight: "bold",   color: "#FFFFFF", background: "rgba(0,0,0,0.75)" },
  "tiktok-bold": { fontSize: 20, fontWeight: 900,      color: "#FACC15", background: "rgba(0,0,0,0.85)" },
  "minimal":     { fontSize: 14, fontWeight: "normal", color: "#FFFFFF", background: "transparent" },
};
```

Store user preference in `localStorage`. Pass `style` through `CaptionPlayerOverlay` → `CaptionComposition`.

---

## Implementation Notes

### Why not the full Remotion CLI?

Full Remotion (`remotion` package) requires a bundler config, a `Root.tsx` composition registry, and a dev server. For in-browser playback, we only need:
- `@remotion/player` — the `<Player>` React component
- `@remotion/captions` — `createTikTokStyleCaptions` utility

This keeps the install lightweight (~150KB total) and avoids any build-time changes.

### Why not keep the CSS/rAF overlay?

The rAF approach works but has these limitations:
- Manual offset math is error-prone as segment counts grow
- No easy path to style presets or animation
- Hard to unit test (side effects, real `requestAnimationFrame`)
- Remotion's `<Sequence>` handles mount/unmount declaratively — zero manual visibility logic

### Performance

`createTikTokStyleCaptions` runs once per mount (useMemo). The `<Player>` renders at 30fps via its own rAF loop — equivalent to what we had manually. No new network requests.

### No Whisper required

Word timing is estimated (evenly distributed per segment). This matches CapCut's behavior when no audio is present. Future: if TTS voiceover is added (NanoBanana), actual word timestamps from the TTS API could replace the estimated distribution.

---

## File Checklist

| File | Action |
|------|--------|
| `frontend/src/lib/captions.ts` | Create — caption factory functions |
| `frontend/src/components/captions/CaptionComposition.tsx` | Create — Remotion composition |
| `frontend/src/components/captions/CaptionPlayerOverlay.tsx` | Create — Player wrapper |
| `frontend/src/app/(dashboard)/generate/[id]/page.tsx` | Modify — replace CSS overlay with CaptionPlayerOverlay in VideoSegmentCard + CombinationPreview |
| `frontend/src/lib/srt.ts` | Keep as-is — still used for SRT download |

---

## Dependencies

- `@remotion/player` ^4.x
- `@remotion/captions` ^4.x
- No new DB schema changes
- No new Edge Functions
- No Modal.com (that's Phase 2 burn-in from `epic-captions.md`)
