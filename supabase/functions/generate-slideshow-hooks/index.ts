import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const { product_id, niche, count = 10 } = await req.json();

    // If neither product_id nor niche provided, use a general fallback
    // (don't block generation — users may not have linked a product yet)

    const sb = getAdminClient();
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not configured");

    // Fetch product context if product_id provided
    let productName = "";
    let productDescription = "";
    if (product_id) {
      const { data: product, error: prodErr } = await sb
        .from("products")
        .select("name, description")
        .eq("id", product_id)
        .eq("owner_id", userId)
        .maybeSingle();

      if (prodErr) throw new Error(prodErr.message);
      if (product) {
        productName = product.name ?? "";
        productDescription = product.description ?? "";
      }
    }

    const topicContext = productName
      ? `${productName} - ${productDescription}`
      : (niche ?? "general lifestyle");

    const systemPrompt = `You write TikTok slideshow hooks. These are the first slide people see. If the hook is boring they swipe away. Your hooks make people stop scrolling.

Generate ${count} hook headlines about: ${topicContext}
${niche ? `Niche: ${niche}` : ""}

WHAT MAKES A GREAT HOOK:
- It creates instant curiosity. The reader HAS to see the rest.
- It's personal and specific. "5 things i wish i knew" > "tips for success"
- It hints at a story. Something happened. Something changed.
- It's slightly provocative or surprising. Makes you think "wait what?"
- A number (3-7) tells the reader exactly what they're getting.

FORMAT:
- Pattern: "[number] [things/reasons/mistakes/habits] [i/that] [specific relatable situation]:"
- ALL lowercase. no capitals ever.
- End with a colon (the slides continue the thought)
- NEVER use em dashes. use commas or periods instead.
- NEVER use: chaos, clarity, aligned, reclaim, journey, unlock, elevate, transform

${productName ? `Product being promoted: ${productName} — ${productDescription}\nSome hooks can reference the product naturally (e.g. "5 things i learned after using ${productName} for a month:") but most hooks should focus on the broader topic. Mix it up.` : ""}

EXAMPLES (for reference, write original ones):
- "5 things i stopped doing after i burned out at 26:"
- "4 mistakes i made my first year freelancing that cost me $20k:"
- "6 habits i picked up from my therapist that actually stuck:"
- "3 reasons i quit my corporate job with no backup plan:"

Output ONLY a JSON object: { "hooks": ["hook1", "hook2", ...] }`;

    const userPrompt = `Generate ${count} hook headlines now.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aiugcgenerator.com",
        "X-Title": "AI UGC Generator",
      },
      body: JSON.stringify({
        model: "xiaomi/mimo-v2-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.75,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errText}`);
    }

    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("Unexpected OpenRouter response");
    }

    // Parse the hooks array from the response
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const hookTexts: string[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.hooks)
        ? parsed.hooks
        : [];

    if (hookTexts.length === 0) {
      throw new Error("No hooks generated");
    }

    // Save hooks to slideshow_hooks table
    const rows = hookTexts.map((text: string) => ({
      owner_id: userId,
      product_id: product_id ?? null,
      niche: niche ?? null,
      text,
      is_used: false,
    }));

    const { data: savedHooks, error: insertErr } = await sb
      .from("slideshow_hooks")
      .insert(rows)
      .select("id, owner_id, product_id, niche, text, is_used, created_at");

    if (insertErr) throw new Error(insertErr.message);

    return json({ data: { hooks: savedHooks } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("generate-slideshow-hooks error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
