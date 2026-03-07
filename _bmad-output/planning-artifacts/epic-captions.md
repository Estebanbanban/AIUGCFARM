# Epic: Automatic Video Captions

**Status:** Phase 1 shipped · Phase 2 planned
**Owner:** engineering
**Last updated:** 2026-03-06

---

## Context

UGC ads perform better with on-screen captions. Most platforms (TikTok, Reels, Shorts) auto-caption natively, but creators need burned-in captions for download-to-edit workflows (CapCut, Premiere, DaVinci).

The generation pipeline already stores `script.hooks/bodies/ctas` with `text` + `duration_seconds` per segment — meaning we never need speech recognition (Whisper/ASR). The source of truth for caption text is the script JSON already in the DB.

---

## Phase 1 — Client-side SRT Download ✅ SHIPPED

**Story 1.1 — SRT generator utility**
- `frontend/src/lib/srt.ts` — pure function `generateSrt(segments: SrtSegment[])` → valid `.srt` string
- No dependencies, fully tested with edge cases (empty text, fractional durations)

**Story 1.2 — Download SRT button in Combination Preview**
- `CombinationPreview` component accepts `hookScript`, `bodyScript`, `ctaScript` props
- "Captions (.srt)" section appears below the Stitch bar when all 3 scripts are present
- One-click download: `cinerads-{genId8}-captions.srt`
- Timing derived from actual rendered `video.duration` (not script's `duration_seconds`) for accuracy
- Import hint copy: "Import into CapCut, Premiere, or DaVinci to add subtitles"

**Result:** Zero infra cost, zero API calls, works offline. Validates caption demand before Phase 2.

---

## Phase 2 — Burned-in Captions (Server-side)

### Overview

Add a "Download with Captions" button that returns an MP4 with the SRT hardcoded into the video frames. Uses Modal.com serverless for FFmpeg processing.

### Architecture

```
User clicks "Download with Captions"
        ↓
Frontend calls Edge Function: caption-video
        ↓
Edge Function:
  1. Fetches MP4 from Supabase Storage (signed URL)
  2. Generates SRT string from generation.script
  3. POSTs {video_base64 or url, srt_content} to Modal endpoint
        ↓
Modal serverless function (Python):
  1. Downloads video from Supabase signed URL
  2. Writes srt to temp file
  3. Runs: ffmpeg -i input.mp4 -vf "subtitles=subs.srt:force_style='...'" output.mp4
  4. Returns captioned video bytes
        ↓
Edge Function:
  1. Receives captioned video
  2. Uploads to Supabase Storage: {userId}/{genId}/{jobKey}_captioned.mp4
  3. Returns signed URL
        ↓
Frontend: triggers browser download of captioned MP4
```

### Stories

**Story 2.1 — Modal.com serverless FFmpeg function**
- Deploy `caption_video.py` to Modal with `apt_install("ffmpeg")`
- Input: `video_url: str`, `srt_content: str`, `style: str` (optional)
- Output: captioned MP4 bytes (binary response)
- Default caption style: white bold Arial 14pt, black outline, bottom-center (Alignment=2)
- Expose as HTTP endpoint with `MODAL_API_KEY` auth header
- Store `MODAL_ENDPOINT_URL` + `MODAL_API_KEY` in Supabase secrets

**Story 2.2 — `caption-video` Supabase Edge Function**
- POST `{ generation_id, job_key }` (job_key = e.g. "hook_1" for single segment, or "stitched" for full combo)
- Auth: requireUserId (user must own the generation)
- Fetch signed URL from `generated-videos` bucket (or stitched URL from client)
- Generate SRT from `generation.script` matched to `job_key`
- Call Modal endpoint → receive captioned MP4
- Upload to `generated-videos/{userId}/{genId}/{jobKey}_captioned.mp4`
- Return new signed URL
- Error: if Modal returns non-200, return 502 so frontend can fall back to SRT download

**Story 2.3 — Frontend: "Download with Captions" button**
- Add button to `VideoSegmentCard` action row and `CombinationPreview` stitch bar
- States: idle → loading (spinner "Adding captions…") → done (triggers download) → error (toast + fallback to SRT)
- Only show when user has script data (same `hasSrt` guard)
- Track analytics event: `trackVideoDownloaded("captioned")`

**Story 2.4 — Caption style presets (optional, post-MVP)**
- Dropdown: Basic (white text, outline) / TikTok Bold (large yellow) / Minimal (white, no outline)
- Pass `style` param to Modal function, which maps to `force_style` FFmpeg string
- Store user preference in localStorage

### Cost Estimate

| Volume | Modal cost/video | Total |
|--------|-----------------|-------|
| 5-15s clip, CPU-only | ~$0.002 | — |
| 100 users × 1 download | $0.002 × 100 | $0.20 |
| 500 users × 3 downloads | $0.002 × 1,500 | $3.00 |
| Within Modal free tier | $30/mo credit | $0 through early growth |

### FFmpeg caption style string

```
force_style='FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,Bold=1,
Alignment=2,BorderStyle=3,Outline=2,Shadow=0,MarginV=20'
```

- `Alignment=2` = bottom-center (standard subtitle position)
- `BorderStyle=3` = opaque box background (alternative to outline)
- `PrimaryColour=&H00FFFFFF` = white text (ABGR hex)

### Dependencies

- Modal.com account (free tier: $30/mo)
- `MODAL_ENDPOINT_URL` env var in Supabase
- `MODAL_API_KEY` env var in Supabase
- No new DB schema changes needed (captioned videos stored as new storage paths)

### Open Questions

1. Should captioned videos be stored permanently or generated on-demand each time?
   - Recommendation: generate on-demand, don't store — keeps storage costs down and avoids stale captions if script is edited
2. Should we support stitched video captioning or only individual segments?
   - Start with stitched only — that's what users export

---

## Phase 3 — Future Considerations (not planned)

- **ASR-based captions**: If we add TTS voiceover via NanoBanana, use Whisper to align actual speech timing with transcript for word-level highlighting
- **Animated captions**: TikTok-style word-by-word pop (requires word-level timestamps from Whisper)
- **Multi-language**: Pass `language` from `generation.language` to force-style font for CJK/Arabic
- **In-browser preview**: Show caption overlay on the video player before downloading (CSS overlay driven by the SRT cues, no FFmpeg needed)
