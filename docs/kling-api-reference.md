# Kling AI 3.0 API Reference

> Source: Official Kling AI Series 3.0 Model API Specification (updated 2026-03-08).
> Generated videos/images are cleared after 30 days — must be downloaded/saved promptly.
> **This is the source of truth for all Kling integration work. Do not rely on training data.**

---

## Changelog (from official docs)

- **[2026.2.10]** Text-to-Video and Image-to-Video support intelligent shot segmentation (`"multi_shot": "intelligence"`)
- **[2026.2.5]** Advanced element supports binding voice
- **[2026.2.3]** Billing refinement for voice; mutual exclusion between reference video and native audio on kling-v3-omni; element creation restrictions
- **[2026.2.2]** New document

---

## Model Capability Map

### Video Generation

| Model | Mode | Duration | Notes |
|-------|------|----------|-------|
| **kling-v3** | std / pro | **3s–15s** | image2video: start frame only OR start+end frame (image_tail) |
| **kling-v3-omni** | std / pro | **3s–15s** | start+end frame, element control, reference video |
| **kling-video-o1** | std / pro | 5s or 10s ONLY | No flexible duration |

### Image Generation

| Model | Resolution | Notes |
|-------|-----------|-------|
| kling-v3-omni | 1K/2K/4K | |
| kling-v3 | 1K/2K | |
| kling-image-o1 | 1K/2K | |

---

## CRITICAL: Duration Support

**kling-v3** and **kling-v3-omni** support any integer duration 3–15 seconds:
```
Duration enum: 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
```

**kling-video-o1** is limited to 5s and 10s only.

For this project, always use **kling-v3** (std) or **kling-v3** (pro) — never kling-v2-6 or kling-video-o1.

---

## Image to Video — Create Task

**POST** `/v1/videos/image2video`

### Key Parameters

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| model_name | string | Optional | kling-v1 | Use `kling-v3` for this project |
| image | string | Optional* | null | Start frame image (URL or base64, no data: prefix) |
| image_tail | string | Optional* | null | **End frame control** — enables seamless segment chaining |
| prompt | string | Optional | null | Script text / motion directive |
| negative_prompt | string | Optional | null | |
| mode | string | Optional | std | `std` (720p) or `pro` (1080p) |
| duration | string | Optional | 5 | **3–15** for kling-v3 |
| sound | string | Optional | off | `on` or `off` |
| aspect_ratio | string | Auto-detected | — | `9:16` for UGC |
| callback_url | string | Optional | — | Webhook on status change |
| external_task_id | string | Optional | — | Unique per user account |

*At least one of `image` or `image_tail` must be provided.

### image_tail Constraints
- Requires `image` (start frame) to also be set — end frame alone is not supported
- Cannot be used together with `dynamic_masks`, `static_mask`, or `camera_control`
- Enables **seamless chaining**: extract last frame of segment N → use as `image` for segment N+1

### Image Requirements
- Formats: `.jpg`, `.jpeg`, `.png`
- Max size: 10MB
- Min dimensions: 300px × 300px
- Aspect ratio: between 1:2.5 and 2.5:1

### Response
```json
{
  "code": 0,
  "data": {
    "task_id": "string",
    "task_status": "submitted | processing | succeed | failed"
  }
}
```

---

## Image to Video — Query Task (Single)

**GET** `/v1/videos/image2video/{task_id}`

### Response
```json
{
  "code": 0,
  "data": {
    "task_id": "string",
    "task_status": "submitted | processing | succeed | failed",
    "task_status_msg": "string",
    "final_unit_deduction": "string",
    "task_result": {
      "videos": [
        {
          "id": "string",
          "url": "string",
          "watermark_url": "string",
          "duration": "string"
        }
      ]
    }
  }
}
```

---

## Text to Video — Create Task

**POST** `/v1/videos/text2video`

Same parameters as image2video minus `image`/`image_tail`. Supports `multi_shot` with `multi_prompt`.

---

## Omni-Video — Create Task

**POST** `/v1/videos/omni-video`

Supports everything kling-v3 does plus `video_list` (reference video), multi-image elements.

---

## Pricing (Prepaid Resource Packs)

All prices are **per second** of video duration.

| Model + Mode | Audio | Cost/sec (units) | Cost/sec (USD) |
|-------------|-------|-----------------|----------------|
| kling-v3 std | no audio | 0.6 units | $0.084 |
| kling-v3 std | with audio (no voice ctrl) | 0.9 units | $0.126 |
| kling-v3 std | with audio + voice ctrl | 1.1 units | $0.154 |
| kling-v3 pro | no audio | 0.8 units | $0.112 |
| kling-v3 pro | with audio (no voice ctrl) | 1.2 units | $0.168 |
| kling-v3 pro | with audio + voice ctrl | 1.4 units | $0.196 |

**Example costs for UGC segments (kling-v3 std, no audio):**
- 3s hook = 1.8 units / $0.252
- 3s CTA = 1.8 units / $0.252
- 5s body = 3.0 units / $0.420
- 7s body = 4.2 units / $0.588

---

## UGC Segment Duration Strategy

Per product spec:
- **Hook**: fixed 3 seconds
- **CTA**: fixed 3 seconds
- **Body**: dynamic, based on word count at ~2.5 words/sec, minimum 3s, maximum 10s
  - Formula: `Math.max(3, Math.min(10, Math.ceil(wordCount / 2.5)))`

---

## Seamless Segment Chaining (Option D)

`image_tail` on `/v1/videos/image2video` (kling-v3 only) enables end-frame control.

**Chaining pattern for Hook → Body → CTA:**
1. Generate Hook with composite image as `image` (start frame)
2. Extract last frame of Hook video (FFmpeg: `ffmpeg -sseof -0.1 -i hook.mp4 -frames:v 1 last_frame.jpg`)
3. Generate Body with composite image as `image`, Hook last frame as `image_tail`... OR use Hook last frame as `image` for natural continuation
4. Repeat for CTA using Body last frame

> Note: This makes generation sequential (not parallel). Use as "seamless mode" — premium option.

---

## Authentication

JWT (HS256), 30-minute expiry. Generated server-side from `KLING_ACCESS_KEY` + `KLING_SECRET_KEY`.

---

## Element Library API

### Create Element
**POST** `/v1/general/advanced-custom-elements`

- `reference_type`: `video_refer` (Video Character Elements) or `image_refer` (Multi-Image Elements)
- Video elements support voice binding; require 1080p video 3–8s, 16:9 or 9:16

### Query Element (Single)
**GET** `/v1/general/advanced-custom-elements/{id}`

### Query Elements (List)
**GET** `/v1/general/advanced-custom-elements`

### Query Preset Elements
**GET** `/v1/general/advanced-presets-elements`

### Delete Element
**POST** `/v1/general/delete-elements`
Body: `{ "element_id": "string" }`

---

## Notes for AIUGC Integration

1. **Always use `kling-v3`** for both std and pro modes — supports flexible 3–15s duration
2. **Never use `kling-v2-6`** — limited to 5s/10s only, outdated
3. **sound: "on"** adds ~50% cost per second — evaluate if worth it vs post-processing TTS
4. **image_tail** is available on kling-v3 for end-frame control (enables seamless chaining)
5. **9:16 aspect ratio** is the UGC format — always pass explicitly
6. Videos expire after 30 days — download to Supabase Storage immediately after generation
