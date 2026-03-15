# SaaS Demo Mode — Design Document

## Summary

SaaS Demo Mode replaces the body segment's visuals with an uploaded screen recording while keeping the AI-generated body audio as voiceover. Hook and CTA remain normal AI-generated videos.

Final output: `hook_video → screen_recording_with_body_voiceover → cta_video`

## Architecture

100% client-side video processing using the existing FFmpeg WASM infrastructure. No new backend video processing needed.

### FFmpeg Pipeline

1. **Extract audio** from AI-generated body video: `-vn -c:a aac`
2. **Scale screen recording** to match format (9:16=1080x1920, 16:9=1920x1080) with letterboxing
3. **Mux audio** onto scaled screen recording: `-map 0:v -map 1:a -shortest`
4. **Trim** hook and CTA (existing silence removal via `prepareClip`)
5. **Concat**: `hook_t.mp4 + saas_body.mp4 + cta_t.mp4`

### Entry Points

1. **Review page** (`/generate/[id]`): Toggle SaaS Demo Mode → upload screen recording → click "Stitch SaaS Demo"
2. **Existing generations**: Any completed generation can have SaaS mode applied retroactively

## Files Created

| File | Purpose |
|---|---|
| `frontend/src/hooks/use-saas-demo-stitcher.ts` | FFmpeg pipeline: audio extraction, scaling, muxing, stitching |
| `frontend/src/components/screen-recording-upload.tsx` | Drag-and-drop upload to Supabase storage |
| `supabase/functions/update-screen-recording/index.ts` | Edge function to persist screen recording path on generation |
| `supabase/migrations/20260315000001_add_screen_recording_url.sql` | DB column + storage bucket + RLS policies |

## Files Modified

| File | Changes |
|---|---|
| `frontend/src/stores/generation-wizard.ts` | Added `saasMode`, `screenRecordingPath` state |
| `frontend/src/types/database.ts` | Added `screen_recording_url` to `Generation` interface |
| `frontend/src/types/api.ts` | Added `screen_recording_url` to `GenerationProgressResponse` |
| `frontend/src/hooks/use-generations.ts` | Added `useUpdateScreenRecording` mutation |
| `frontend/src/app/(dashboard)/generate/[id]/page.tsx` | SaaS mode toggle, upload integration, dual stitcher |
| `supabase/functions/video-status/index.ts` | Signs and returns `screen_recording_url` |

## Data Flow

```
User toggles SaaS Mode ON on review page
  → Uploads screen recording → Supabase `screen-recordings` bucket
  → Calls update-screen-recording edge fn → saves path to generations.screen_recording_url
  → video-status returns signed URL for screen recording
  → User clicks "Stitch SaaS Demo"
  → useSaasDemoStitcher runs FFmpeg pipeline in browser
  → Output: blob URL for download
```
