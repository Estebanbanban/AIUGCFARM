const KLING_BASE = "https://api.klingai.com/v1";

export interface KlingSubmitResult {
  job_id: string;
  status: string;
}

export interface KlingJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  error_message?: string;
}

/**
 * Submit a video generation job to Kling AI.
 */
export async function submitKlingJob(params: {
  image_url: string;
  script: string;
  duration: number;
  aspect_ratio?: string;
  mode?: string;
}): Promise<KlingSubmitResult> {
  const apiKey = Deno.env.get("KLING_API_KEY");
  if (!apiKey) throw new Error("KLING_API_KEY not configured");

  const res = await fetch(`${KLING_BASE}/videos/image2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: params.image_url,
      prompt: params.script,
      duration: String(params.duration),
      aspect_ratio: params.aspect_ratio || "9:16",
      mode: params.mode || "standard",
    }),
  });

  if (!res.ok) {
    let errBody: string;
    try {
      errBody = await res.text();
    } catch {
      errBody = `HTTP ${res.status}`;
    }
    throw new Error(`Kling submit error ${res.status}: ${errBody}`);
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new Error("Kling submit returned non-JSON response");
  }

  // Kling API wraps response in a `data` envelope
  const data = (body.data ?? body) as Record<string, unknown>;
  const jobId = data.task_id ?? data.job_id;
  if (!jobId || typeof jobId !== "string") {
    throw new Error(`Kling submit: no job_id in response: ${JSON.stringify(body)}`);
  }

  return {
    job_id: jobId,
    status: (data.task_status as string) ?? "pending",
  };
}

/**
 * Check the status of a Kling AI video generation job.
 */
export async function checkKlingJob(jobId: string): Promise<KlingJobStatus> {
  const apiKey = Deno.env.get("KLING_API_KEY");
  if (!apiKey) throw new Error("KLING_API_KEY not configured");

  const res = await fetch(`${KLING_BASE}/videos/image2video/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    let errBody: string;
    try {
      errBody = await res.text();
    } catch {
      errBody = `HTTP ${res.status}`;
    }
    throw new Error(`Kling status error ${res.status}: ${errBody}`);
  }

  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    throw new Error("Kling status check returned non-JSON response");
  }

  // Kling API wraps response in a `data` envelope
  const data = (body.data ?? body) as Record<string, unknown>;

  // Normalize status from task_status (Kling's field) or status
  const rawStatus = (data.task_status ?? data.status ?? "pending") as string;

  // Normalize Kling-specific statuses to our internal set
  let status: KlingJobStatus["status"];
  switch (rawStatus) {
    case "completed":
    case "succeed":
      status = "completed";
      break;
    case "failed":
    case "error":
      status = "failed";
      break;
    case "processing":
    case "running":
      status = "processing";
      break;
    default:
      status = "pending";
  }

  // Extract video URL: Kling nests it in task_result.videos[0].url
  let videoUrl: string | undefined;
  if (status === "completed") {
    const taskResult = data.task_result as Record<string, unknown> | undefined;
    if (taskResult) {
      const videos = taskResult.videos as Array<Record<string, unknown>> | undefined;
      if (videos && videos.length > 0) {
        videoUrl = videos[0].url as string | undefined;
      }
    }
    // Fallback: check direct video_url field
    if (!videoUrl) {
      videoUrl = (data.video_url ?? data.output_url) as string | undefined;
    }
  }

  // Extract error message if failed
  let errorMessage: string | undefined;
  if (status === "failed") {
    errorMessage = (data.task_status_msg ?? data.error_message ?? data.message) as string | undefined;
  }

  return {
    job_id: jobId,
    status,
    video_url: videoUrl,
    error_message: errorMessage,
  };
}
