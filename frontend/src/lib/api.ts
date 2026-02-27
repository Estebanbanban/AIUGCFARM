import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_URL = `${supabaseUrl}/functions/v1`;

async function parseEdgeError(res: Response): Promise<string> {
  const json = await res.json().catch(() => null);
  if (json?.detail) return String(json.detail);
  if (json?.error?.message) return String(json.error.message);

  const text = await res.text().catch(() => "");
  if (text) return text;

  if (res.status === 401) return "Authentication required. Please sign in again.";
  return `Edge function error: ${res.status}`;
}

export async function callEdge<T>(
  fn: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // Use getUser() — not getSession() — to force server-side token validation.
  // getSession() reads from local storage/cookies and can return a stale session
  // with an expired or invalid access_token without hitting the network. getUser()
  // always validates against the Supabase Auth server and automatically refreshes
  // the session when the access_token has expired, ensuring we always send a
  // current, server-verified token to edge functions.
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (!user || userError) {
    // Token is invalid or expired and could not be refreshed — force sign-out
    await supabase.auth.signOut();
    throw new Error("Authentication required. Please sign in again.");
  }

  // After getUser() succeeds the session is guaranteed to be fresh (auto-refreshed)
  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Authentication required. Please sign in again.");

  const makeRequest = (accessToken: string) =>
    fetch(`${EDGE_URL}/${fn}`, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

  let res = await makeRequest(session.access_token);

  if (res.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    const retrySession = refreshed.data.session;
    if (retrySession?.access_token) {
      res = await makeRequest(retrySession.access_token);
    }
  }

  if (!res.ok) {
    throw new Error(await parseEdgeError(res));
  }
  return res.json();
}

/** Public Edge Function call — no auth required, but attaches token if available for higher rate limits */
export async function callEdgePublic<T>(
  fn: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  headers.apikey = supabaseAnonKey;

  try {
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) headers.Authorization = `Bearer ${session.access_token}`;
  } catch { /* no auth available */ }

  const res = await fetch(`${EDGE_URL}/${fn}`, {
    method: options.method || "POST",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Edge function error: ${res.status}`);
  }
  return res.json();
}

/** Multipart form data upload — requires auth */
export async function callEdgeMultipart<T>(
  fn: string,
  formData: FormData
): Promise<T> {
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

  // Same pattern as callEdge: use getUser() to force server validation before
  // reading the session, ensuring the access_token is fresh.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (!user || userError) {
    await supabase.auth.signOut();
    throw new Error("Not authenticated");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${EDGE_URL}/${fn}`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Edge function error: ${res.status}`);
  }
  return res.json();
}
