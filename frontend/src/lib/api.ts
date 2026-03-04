import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_URL = `${supabaseUrl}/functions/v1`;

/** Edge function error that carries the HTTP status code for precise frontend handling. */
export class EdgeError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "EdgeError";
  }
}

const DEFAULT_EDGE_TIMEOUT_MS = 180_000;

/** Remove Supabase project URLs from error messages shown to users. */
function sanitizeErrorMessage(msg: string): string {
  return msg.replace(/https?:\/\/[a-z0-9]+\.supabase\.(co|in)\/[^\s]*/g, "[internal]");
}

async function parseEdgeError(res: Response): Promise<{ message: string; code?: string }> {
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      const json = JSON.parse(text);
      const code = json?.code as string | undefined;
      if (json?.detail) return { message: String(json.detail), code };
      if (json?.error?.message) return { message: String(json.error.message), code };
    } catch {
      // Non-JSON payload; return trimmed text below.
    }
    return { message: text.slice(0, 500) };
  }

  if (res.status === 401) return { message: "Authentication required. Please sign in again." };
  return { message: `Edge function error: ${res.status}` };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_EDGE_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getEdgeAccessToken(
  supabase: ReturnType<typeof createBrowserClient>,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    return session.access_token;
  }

  // Fallback path: force server validation/refresh if local session is stale.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user || userError) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const {
    data: { session: refreshedSession },
  } = await supabase.auth.getSession();
  if (!refreshedSession?.access_token) {
    throw new Error("Authentication required. Please sign in again.");
  }
  return refreshedSession.access_token;
}

export async function callEdge<T>(
  fn: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  const timeoutMs = options.timeoutMs ?? DEFAULT_EDGE_TIMEOUT_MS;
  let accessToken = await getEdgeAccessToken(supabase);

  const makeRequest = (accessToken: string) =>
    fetchWithTimeout(`${EDGE_URL}/${fn}`, {
      method: options.method || "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    }, timeoutMs);

  let res = await makeRequest(accessToken);

  if (res.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retrySession = refreshed.data.session;
    if (retrySession?.access_token) {
      accessToken = retrySession.access_token;
      res = await makeRequest(accessToken);
    }
  }

  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new EdgeError(401, "Authentication required. Please sign in again.");
  }

  if (!res.ok) {
    const { message, code } = await parseEdgeError(res);
    throw new EdgeError(res.status, sanitizeErrorMessage(message), code);
  }
  return res.json();
}

/** Public Edge Function call, no auth required, but attaches token if available for higher rate limits */
export async function callEdgePublic<T>(
  fn: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_EDGE_TIMEOUT_MS;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers.apikey = supabaseAnonKey;

  try {
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) headers.Authorization = `Bearer ${session.access_token}`;
  } catch { /* no auth available */ }

  const res = await fetchWithTimeout(`${EDGE_URL}/${fn}`, {
    method: options.method || "POST",
    mode: "cors",
    credentials: "omit",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  }, timeoutMs);

  if (!res.ok) {
    const { message, code } = await parseEdgeError(res);
    throw new EdgeError(res.status, sanitizeErrorMessage(message), code);
  }
  return res.json();
}

/** Multipart form data upload, requires auth */
export async function callEdgeMultipart<T>(
  fn: string,
  formData: FormData,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  const timeoutMs = options.timeoutMs ?? DEFAULT_EDGE_TIMEOUT_MS;
  let accessToken = await getEdgeAccessToken(supabase);

  const makeRequest = (token: string) =>
    fetchWithTimeout(`${EDGE_URL}/${fn}`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }, timeoutMs);

  let res = await makeRequest(accessToken);

  if (res.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retrySession = refreshed.data.session;
    if (retrySession?.access_token) {
      accessToken = retrySession.access_token;
      res = await makeRequest(accessToken);
    }
  }

  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new EdgeError(401, "Authentication required. Please sign in again.");
  }

  if (!res.ok) {
    const { message, code } = await parseEdgeError(res);
    throw new EdgeError(res.status, sanitizeErrorMessage(message), code);
  }
  return res.json();
}
