const KLING_BASE = "https://api.kling.ai/v1";

export async function submitKlingJob(params: {
  image_url: string;
  script: string;
  duration: number;
  aspect_ratio?: string;
  mode?: string;
}): Promise<{ job_id: string; status: string }> {
  const apiKey = Deno.env.get("KLING_API_KEY");
  if (!apiKey) throw new Error("KLING_API_KEY not configured");

  const res = await fetch(`${KLING_BASE}/videos/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: params.image_url,
      script: params.script,
      duration: params.duration,
      aspect_ratio: params.aspect_ratio || "9:16",
      mode: params.mode || "standard",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function checkKlingJob(
  jobId: string,
): Promise<{ job_id: string; status: string; video_url?: string }> {
  const apiKey = Deno.env.get("KLING_API_KEY");
  if (!apiKey) throw new Error("KLING_API_KEY not configured");

  const res = await fetch(`${KLING_BASE}/videos/${jobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Kling status error ${res.status}: ${err}`);
  }

  return res.json();
}
