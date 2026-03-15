/**
 * Sora 2 Video Generation API client.
 * Supports text-to-video and image-to-video via the POST /v1/videos endpoint.
 * Status polling via GET /v1/videos/{id}.
 * Video download via GET /v1/videos/{id}/content.
 */

const SORA_BASE = "https://api.openai.com/v1/videos";

export type SoraModel = "sora-2" | "sora-2-pro";

export interface SoraSubmitResult {
  job_id: string;
  status: string;
  model_name: SoraModel;
}

export interface SoraJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  video_url?: string;
  error_message?: string;
}

function getOpenAIKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY must be set");
  return key;
}

/**
 * Submit a video generation job to Sora 2.
 *
 * - If input_reference_blob is provided, sends multipart/form-data (image-to-video).
 * - Otherwise, sends JSON (text-to-video).
 *
 * @param params.prompt - Video generation prompt
 * @param params.model - "sora-2" (standard) or "sora-2-pro" (pro)
 * @param params.seconds - Duration: "4", "8", or "12" (string)
 * @param params.size - Resolution e.g. "720x1280" or "1080x1920"
 * @param params.input_reference_blob - Optional image blob for image-to-video
 */
export async function submitSoraJob(params: {
  prompt: string;
  model?: SoraModel;
  seconds?: number | string;
  size?: string;
  input_reference_blob?: Blob;
}): Promise<SoraSubmitResult> {
  const apiKey = getOpenAIKey();
  const model = params.model ?? "sora-2";
  // Sora API accepts "4", "8", or "12" as string values only
  const validSeconds = ["4", "8", "12"];
  const rawSeconds = String(params.seconds ?? 12);
  const seconds = validSeconds.includes(rawSeconds) ? rawSeconds : "12";
  // Sora valid sizes: 1280x720, 1920x1080, 1080x1920
  // For 9:16 vertical UGC: use 1080x1920 (only portrait option available)
  // For landscape: 1280x720 (sora-2) or 1920x1080 (sora-2-pro)
  const size = params.size ?? "1080x1920";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    if (params.input_reference_blob) {
      // Multipart form: image-to-video
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", params.prompt);
      form.append("seconds", String(seconds));
      form.append("size", size);
      form.append("input_reference", params.input_reference_blob, "reference.jpg");

      res = await fetch(SORA_BASE, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } else {
      // JSON: text-to-video
      res = await fetch(SORA_BASE, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, prompt: params.prompt, seconds: seconds, size }),
        signal: controller.signal,
      });
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Sora API submission timed out after 30s. The service may be under load — please retry.");
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    let errBody: string;
    try {
      errBody = await res.text();
    } catch {
      errBody = `HTTP ${res.status}`;
    }
    throw new Error(`Sora submit error ${res.status}: ${errBody}`);
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new Error("Sora submit returned non-JSON response");
  }

  const jobId = body.id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error(`Sora submit: no job id in response: ${JSON.stringify(body)}`);
  }

  return {
    job_id: jobId as string,
    status: (body.status as string) ?? "queued",
    model_name: model,
  };
}

/**
 * Check the status of a Sora 2 video generation job.
 * GET /v1/videos/{video_id}
 */
export async function checkSoraJob(jobId: string): Promise<SoraJobStatus> {
  const apiKey = getOpenAIKey();

  const res = await fetch(`${SORA_BASE}/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    let errBody: string;
    try {
      errBody = await res.text();
    } catch {
      errBody = `HTTP ${res.status}`;
    }
    throw new Error(`Sora status error ${res.status}: ${errBody}`);
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new Error("Sora status check returned non-JSON response");
  }

  const rawStatus = (body.status ?? "queued") as string;

  // Normalize Sora 2 status strings to internal 4-state enum
  let status: SoraJobStatus["status"];
  switch (rawStatus) {
    case "completed":
      status = "completed";
      break;
    case "failed":
      status = "failed";
      break;
    case "in_progress":
      status = "processing";
      break;
    case "queued":
    default:
      status = "pending";
  }

  let errorMessage: string | undefined;
  if (status === "failed") {
    const err = body.error as Record<string, unknown> | undefined;
    errorMessage = (err?.message ?? body.error_message ?? body.message) as string | undefined;
  }

  // Sora 2 uses GET /content to download — set a marker URL so callers detect completion
  let videoUrl: string | undefined;
  if (status === "completed") {
    videoUrl = `${SORA_BASE}/${jobId}/content`;
  }

  return {
    job_id: jobId,
    status,
    progress: (body.progress as number) ?? 0,
    video_url: videoUrl,
    error_message: errorMessage,
  };
}

/**
 * Download a completed Sora 2 video as a Blob.
 * GET /v1/videos/{video_id}/content
 *
 * Download URLs are valid for max 1 hour after generation.
 */
export async function downloadSoraVideo(jobId: string): Promise<Blob> {
  const apiKey = getOpenAIKey();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min for large video downloads

  let res: Response;
  try {
    res = await fetch(`${SORA_BASE}/${jobId}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Sora video download timed out after 120s.");
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!res.ok) {
    let errBody: string;
    try {
      errBody = await res.text();
    } catch {
      errBody = `HTTP ${res.status}`;
    }
    throw new Error(`Sora download error ${res.status}: ${errBody}`);
  }

  return await res.blob();
}
