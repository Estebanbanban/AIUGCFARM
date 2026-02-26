import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EDGE_URL = `${supabaseUrl}/functions/v1`;

export async function callEdge<T>(
  fn: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${EDGE_URL}/${fn}`, {
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Edge function error: ${res.status}`);
  }
  return res.json();
}
