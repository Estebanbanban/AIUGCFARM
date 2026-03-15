import { getCorsHeaders } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const { email, phone } = await req.json() as { email?: string; phone?: string };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return json({ detail: "Valid email is required" }, cors, 400);
    }

    const sb = getAdminClient();

    const { error } = await sb
      .from("waitlist")
      .upsert(
        { email: email.trim().toLowerCase(), phone: phone?.trim() || null },
        { onConflict: "email" },
      );

    if (error) throw new Error(error.message);

    return json({ data: { ok: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("join-waitlist error:", e);
    return json({ detail: "Something went wrong. Please try again." }, cors, 500);
  }
});
