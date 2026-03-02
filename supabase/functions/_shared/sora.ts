const SORA_BASE = "https://api.openai.com/v1/video/generations";

export interface SoraSubmitResult {
  job_id: string;
  status: string;
  model_name: string;
}

export interface SoraJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  error_message?: string;
}

function getOpenAIKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY must be set");
  return key;
}

/**
 * Submit a video generation job to Sora (OpenAI image-to-video).
 * Sora requires the image as a file upload (multipart/form-data), not a URL.
 *
 * @param params.composite_image_path - Supabase Storage path to download & upload to Sora
 * @param params.prompt - Video generation prompt
 * @param params.duration - Duration in seconds (Sora supports 5 or 10)
 */
export async function submitSoraJob(params: {
  composite_image_blob: Blob;
  prompt: string;
  duration: number;
}): Promise<SoraSubmitResult> {
  const apiKey = getOpenAIKey();

  // Sora only supports 5s or 10s — round to nearest supported value
  const duration = params.duration <= 5 ? 5 : 10;

  const form = new FormData();
  form.append("model", "sora-1.0");
  form.append("prompt", params.prompt);
  form.append("duration", String(duration));
  form.append("image", params.composite_image_blob, "composite.jpg");

  const res = await fetch(SORA_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

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

  const jobId = body.id ?? body.job_id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error(`Sora submit: no job id in response: ${JSON.stringify(body)}`);
  }

  return {
    job_id: jobId as string,
    status: (body.status as string) ?? "pending",
    model_name: "sora-1.0",
  };
}

/**
 * Check the status of a Sora video generation job.
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

  const rawStatus = (body.status ?? "pending") as string;

  // Normalize OpenAI status strings to internal 4-state enum
  let status: SoraJobStatus["status"];
  switch (rawStatus) {
    case "completed":
    case "succeeded":
      status = "completed";
      break;
    case "failed":
    case "error":
      status = "failed";
      break;
    case "in_progress":
    case "processing":
    case "running":
      status = "processing";
      break;
    default:
      status = "pending";
  }

  // Extract video URL from completed job
  let videoUrl: string | undefined;
  if (status === "completed") {
    // OpenAI Sora response: { generations: [{ url: "..." }] } or { video_url: "..." }
    const generations = body.generations as Array<Record<string, unknown>> | undefined;
    if (generations && generations.length > 0) {
      videoUrl = generations[0].url as string | undefined;
    }
    if (!videoUrl) {
      videoUrl = (body.video_url ?? body.output_url) as string | undefined;
    }
  }

  let errorMessage: string | undefined;
  if (status === "failed") {
    const err = body.error as Record<string, unknown> | undefined;
    errorMessage = (err?.message ?? body.error_message ?? body.message) as string | undefined;
  }

  return {
    job_id: jobId,
    status,
    video_url: videoUrl,
    error_message: errorMessage,
  };
}
