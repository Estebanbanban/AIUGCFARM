# Kling AI 3.0 API Reference

> Compiled from official Kling AI documentation (Feb 2026).
> Generated videos/images are cleared after 30 days — must be downloaded to R2 immediately.

---

## Authentication

- **Header:** `Authorization: Bearer {JWT_TOKEN}`
- **Base URLs:**
  - Singapore: `https://api-singapore.klingai.com`
  - Global: Check Kling developer portal for regional endpoints
- **Content-Type:** `application/json`

---

## Models Available

### Video Models

| Model ID | Type | Duration | Modes |
|---|---|---|---|
| `kling-v3` | Text-to-Video, Image-to-Video | 3-15s | std, pro |
| `kling-v3-omni` | Omni (unified endpoint) | 3-15s | std, pro |
| `kling-video-o1` | Text-to-Video, Image-to-Video | 3-10s (5s/10s only) | std, pro |

### Image Models

| Model ID | Resolutions |
|---|---|
| `kling-v3` | 1K, 2K |
| `kling-v3-omni` | 1K, 2K, 4K |
| `kling-image-o1` | 1K, 2K |

---

## Video Generation Endpoints

### Image-to-Video — Create Task

**Our primary endpoint for UGC video generation (POV image → video segments)**

```
POST /v1/videos/image2video
```

**Request Body:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `model_name` | string | Optional | `kling-v1` | Model. Use `kling-v3` for our pipeline |
| `image` | string | Optional | null | Start frame image (Base64 or URL). Max 10MB, min 300px sides, aspect ratio 1:2.5 to 2.5:1 |
| `image_tail` | string | Optional | null | End frame image. Same constraints as `image`. Cannot coexist with camera_control |
| `prompt` | string | Optional | null | Positive text prompt. Max 2500 chars. Required when `multi_shot=false` |
| `negative_prompt` | string | Optional | null | Negative prompt. Max 2500 chars |
| `multi_shot` | boolean | Optional | false | Enable multi-shot generation. When true, `prompt` is ignored |
| `shot_type` | string | Optional | null | `customize` or `intelligence`. Required when `multi_shot=true` |
| `multi_prompt` | array | Optional | null | Storyboard definitions (max 6 shots). Required when `multi_shot=true` AND `shot_type=customize` |
| `element_list` | array | Optional | null | Reference elements by ID. Max 3 elements. Mutually exclusive with `voice_list` |
| `voice_list` | array | Optional | null | Voice IDs for speech. Max 2 voices. Mutually exclusive with `element_list` |
| `sound` | string | Optional | `off` | Generate native audio. `on` or `off`. Only v2.6+ models |
| `cfg_scale` | float | Optional | 0.5 | Prompt adherence [0-1]. Only kling-v1.x |
| `mode` | string | Optional | `std` | `std` (720p) or `pro` (1080p) |
| `duration` | string | Optional | `5` | Video length in seconds. Enum: `3,4,5,6,7,8,9,10,11,12,13,14,15` |
| `watermark_info` | object | Optional | null | `{"enabled": true/false}` |
| `callback_url` | string | Optional | null | Webhook URL for task status changes |
| `external_task_id` | string | Optional | null | Custom task ID (must be unique per account) |

**Multi-prompt structure:**

```json
{
  "multi_prompt": [
    { "index": 1, "prompt": "Scene description...", "duration": "5" },
    { "index": 2, "prompt": "Next scene...", "duration": "5" }
  ]
}
```

- Max 6 storyboards, min 1
- Max 512 chars per storyboard prompt
- Each duration >= 1s, sum must equal total `duration`

**Response:**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "submitted | processing | succeed | failed",
    "task_info": { "external_task_id": "string" },
    "created_at": 1722769557708,
    "updated_at": 1722769557708
  }
}
```

---

### Image-to-Video — Query Task

```
GET /v1/videos/image2video/{task_id}
```

Or query by custom ID: `GET /v1/videos/image2video/{external_task_id}`

**Response (on success):**

```json
{
  "code": 0,
  "message": "string",
  "request_id": "string",
  "data": {
    "task_id": "string",
    "task_status": "submitted | processing | succeed | failed",
    "task_status_msg": "string",
    "task_info": { "external_task_id": "string" },
    "watermark_info": { "enabled": false },
    "final_unit_deduction": "string",
    "created_at": 1722769557708,
    "updated_at": 1722769557708,
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

### Image-to-Video — Query Task List

```
GET /v1/videos/image2video?pageNum=1&pageSize=30
```

---

### Text-to-Video — Create Task

```
POST /v1/videos/text2video
```

Same parameters as Image-to-Video EXCEPT:
- No `image` / `image_tail` parameters
- `aspect_ratio` defaults to `16:9` (enum: `16:9`, `9:16`, `1:1`)
- `prompt` is the primary input

---

### Text-to-Video — Query Task

```
GET /v1/videos/text2video/{task_id}
```

Same response format as Image-to-Video query.

---

### Omni-Video — Create Task (Unified Endpoint)

```
POST /v1/videos/omni-video
```

**Additional parameters vs standard endpoints:**

| Parameter | Type | Description |
|---|---|---|
| `image_list` | array | Multiple reference images. `[{"image_url": "...", "type": "first_frame|end_frame"}]` |
| `element_list` | array | Elements by ID. `[{"element_id": long}]` |
| `video_list` | array | Reference video. `[{"video_url": "...", "refer_type": "base|feature", "keep_original_sound": "yes|no"}]` |
| `aspect_ratio` | string | Required when no first-frame reference. `16:9`, `9:16`, `1:1` |

**Image list constraints:**
- With reference video: images + elements <= 4
- Without reference video: images + elements <= 7
- End frame not supported with > 2 images

**Video list constraints:**
- Only .mp4/.mov, 3-10s duration, 720-2160px, 24-60fps
- Max 1 video, max 200MB
- When reference video present, `sound` must be `off`

---

## Image Generation Endpoints

### Omni-Image — Create Task

```
POST /v1/images/omni-image
```

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `model_name` | string | Optional | `kling-image-o1` | `kling-image-o1` or `kling-v3-omni` |
| `prompt` | string | Required | null | Text prompt. Max 2500 chars. Use `<<<image_1>>>` to reference images |
| `image_list` | array | Optional | null | `[{"image": "url_or_base64"}]`. Images + elements <= 10 |
| `element_list` | array | Optional | null | `[{"element_id": long}]` |
| `resolution` | string | Optional | `1k` | `1k`, `2k`, `4k` |
| `result_type` | string | Optional | `single` | `single` or `series` |
| `n` | int | Optional | 1 | Number of images [1-9] |
| `series_amount` | int | Optional | 4 | Images in series [2-9] |
| `aspect_ratio` | string | Optional | `auto` | `16:9`, `9:16`, `1:1`, `4:3`, `3:4`, `3:2`, `2:3`, `21:9`, `auto` |
| `callback_url` | string | Optional | null | Webhook URL |
| `external_task_id` | string | Optional | null | Custom task ID |

### Standard Image — Create Task

```
POST /v1/images/generations
```

Same as Omni-Image but with `image` (single string) instead of `image_list`, and `negative_prompt` support.

---

## Element Library Endpoints

### Create Element

```
POST /v1/general/advanced-custom-elements
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `element_name` | string | Required | Max 20 chars |
| `element_description` | string | Required | Max 100 chars |
| `reference_type` | string | Required | `video_refer` (Video Character) or `image_refer` (Multi-Image) |
| `element_image_list` | object | Conditional | Required when `image_refer`. Contains `frontal_image` + `refer_images` (1-3 additional) |
| `element_video_list` | object | Conditional | Required when `video_refer`. Single video, .mp4/.mov, 1080p, 3-8s, 16:9 or 9:16, max 200MB |
| `element_voice_id` | string | Optional | Bind existing voice to element. Only video elements |
| `tag_list` | array | Optional | Tags: `o_101`-`o_108` (Hottest, Character, Animal, Item, Costume, Scene, Effect, Others) |
| `callback_url` | string | Optional | Webhook URL |
| `external_task_id` | string | Optional | Custom ID |

### Query Element

```
GET /v1/general/advanced-custom-elements/{task_id}
GET /v1/general/advanced-custom-elements?pageNum=1&pageSize=30
```

### Query Preset Elements

```
GET /v1/general/advanced-presets-elements?pageNum=1&pageSize=30
```

### Delete Element

```
POST /v1/general/delete-elements
Body: { "element_id": "string" }
```

---

## Task Status Values

| Status | Description |
|---|---|
| `submitted` | Task created, queued |
| `processing` | Actively generating |
| `succeed` | Complete — video URL available |
| `failed` | Error — check `task_status_msg` |

---

## Pricing (Prepaid Resource Packs)

### Kling V3.0 Video

| Configuration | Units/sec | $/sec |
|---|---|---|
| Std, no audio | 0.6 | $0.084 |
| Std, with audio (no voice control) | 0.9 | $0.126 |
| Std, with audio + voice control | 1.1 | $0.154 |
| Pro, no audio | 0.8 | $0.112 |
| Pro, with audio (no voice control) | 1.2 | $0.168 |
| Pro, with audio + voice control | 1.4 | $0.196 |

### Kling V3.0 Omni Video

| Configuration | Units/sec | $/sec |
|---|---|---|
| Std, no video input, no audio | 0.6 | $0.084 |
| Std, no video input, with audio | 0.8 | $0.112 |
| Std, with video input, no audio | 0.9 | $0.126 |
| Std, with video input, with audio | 1.1 | $0.154 |
| Pro, no video input, no audio | 0.8 | $0.112 |
| Pro, no video input, with audio | 1.0 | $0.14 |
| Pro, with video input, no audio | 1.2 | $0.168 |
| Pro, with video input, with audio | 1.4 | $0.196 |

### Kling V3.0 Images

| Resolution | Units | Price |
|---|---|---|
| 1K / 2K | 8 | $0.028 |
| 4K (Omni only) | 16 | $0.056 |

### Cost Estimate per UGC Generation (our pipeline)

Assuming pro mode, no audio, image-to-video:
- Hook segment (5s): 5 × $0.112 = **$0.56**
- Body segment (10s): 10 × $0.112 = **$1.12**
- CTA segment (5s): 5 × $0.112 = **$0.56**
- **Total per variant: ~$2.24**
- **Total per generation (4 variants): ~$8.96**

With std mode:
- Hook (5s): $0.42, Body (10s): $0.84, CTA (5s): $0.42
- **Total per variant: ~$1.68**
- **Total per generation (4 variants): ~$6.72**

---

## Callback/Webhook Protocol

Configure via `callback_url` parameter on task creation.

```json
{
  "webhook_config": {
    "endpoint": "https://your-domain.com/webhooks/kling",
    "secret": "your_webhook_secret"
  }
}
```

Server sends notification on task status changes (submitted → processing → succeed/failed).

---

## Key Constraints for Our Pipeline

1. **Lip sync degrades after ~10s** → Generate segments independently (Hook, Body, CTA)
2. **Image constraints:** Max 10MB, min 300px, aspect ratio 1:2.5 to 2.5:1
3. **Video output cleared after 30 days** → Must download to R2 immediately on `succeed`
4. **Multi-shot available:** Can generate up to 6 storyboards in one task (3-15s total)
5. **Element system:** Can create persistent character elements for consistent persona across generations
6. **No audio generation on reference video tasks** → Sound must be `off` when using video input
7. **Duration flexibility:** 3-15s in 1-second increments on kling-v3

---

## Architecture Implications

### Multi-shot as Alternative to FFmpeg Stitching

Kling V3's `multi_shot` feature lets us generate multi-segment videos **in a single API call** instead of:
1. Generating 3 separate segments (hook/body/cta)
2. Downloading all 3
3. FFmpeg stitching them together

**Trade-off:**
- Multi-shot: Simpler pipeline, single API call, but less control over individual segments
- Segmented + FFmpeg: More control, can retry individual failed segments, but more complex pipeline

**Recommendation:** Use multi-shot for Easy Mode (simpler), keep segmented approach for Expert Mode (more control).

### Element Library for Persona Consistency

Instead of passing the persona reference image every time, we can:
1. Create a Kling Element from the NanoBanana-generated persona image
2. Reference the `element_id` in all future video generations
3. This may improve persona consistency across videos

### Callback vs Polling

Kling supports `callback_url` — use this with Inngest to avoid polling:
1. Create Kling task with `callback_url` pointing to our worker
2. Inngest step waits for webhook event
3. On callback, Inngest continues pipeline

This is more efficient than polling every 10s.
