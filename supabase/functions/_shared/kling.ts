const KLING_BASE = "https://api.klingai.com/v1";

export interface KlingSubmitResult {
  job_id: string;
  status: string;
  model_name: string;
  mode: string;
}

export interface KlingJobStatus {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  video_url?: string;
  error_message?: string;
}

/**
 * Generate a short-lived JWT for Kling AI API auth.
 * Kling uses HS256 JWT signed with the Secret Key, with `iss` set to the Access Key.
 * Token is valid for 30 minutes (1800s).
 */
async function generateKlingToken(): Promise<string> {
  const ak = Deno.env.get("KLING_ACCESS_KEY");
  const sk = Deno.env.get("KLING_SECRET_KEY");
  if (!ak || !sk) throw new Error("KLING_ACCESS_KEY and KLING_SECRET_KEY must be set");

  const now = Math.floor(Date.now() / 1000);

  const b64url = (obj: object) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({ iss: ak, iat: now, nbf: now - 5, exp: now + 1800 });
  const signingInput = `${header}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sk),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signingInput}.${sigB64}`;
}

/**
 * Submit a video generation job to Kling AI.
 * image2video endpoint infers aspect ratio from the input image  -  no aspect_ratio param.
 *
 * @param model_name - "kling-v2-6" (standard, $0.042/s) or "kling-v3" (hd, $0.084/s).
 *                     Defaults to "kling-v2-6".
 */
export async function submitKlingJob(params: {
  image_url: string;
  script: string;
  duration: number;
  mode?: "pro" | "std";
  sound?: "on" | "off";
  model_name?: string;
}): Promise<KlingSubmitResult> {
  const token = await generateKlingToken();
  const requestedModel = params.model_name || "kling-v2-6";
  const requestedMode = params.mode || "pro";
  const requestedSound = params.sound || (requestedMode === "pro" ? "on" : "off");

  const res = await fetch(`${KLING_BASE}/videos/image2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model_name: requestedModel,
      image: params.image_url,
      prompt: params.script,
      duration: String(params.duration),
      mode: requestedMode,
      sound: requestedSound,
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
    model_name: (data.model_name as string) ?? requestedModel,
    mode: (data.mode as string) ?? requestedMode,
  };
}

/**
 * Check the status of a Kling AI video generation job.
 */
export async function checkKlingJob(jobId: string): Promise<KlingJobStatus> {
  const token = await generateKlingToken();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res: Response;
  try {
    res = await fetch(`${KLING_BASE}/videos/image2video/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

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
    errorMessage = (data.task_status_msg ?? data.error_message ?? data.message) as
      | string
      | undefined;
  }

  return {
    job_id: jobId,
    status,
    video_url: videoUrl,
    error_message: errorMessage,
  };
}
