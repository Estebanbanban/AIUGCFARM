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

    const systemPrompt = `You are a TikTok content strategist creating hook headlines for short-form slideshow content.

Generate ${count} hook headlines for slideshows about ${topicContext}.

Rules:
- First person "I" perspective always
- Format: "[number] [action noun] [I/that] [relatable situation]:"
- ALL lowercase, no capitalization anywhere
- Each hook must feel personal, vulnerable, relatable
- Avoid motivational-poster language (no "clarity", "aligned", "reclaim", "chaos", "journey")
- Sound like someone texting in a group chat, NOT an influencer
- 7th grade reading level
- Number should be 3-7 (most common: 5)
- End each hook with a colon

${productName ? `Product context: ${productName} - ${productDescription}` : ""}
${niche ? `Niche: ${niche}` : ""}

Output ONLY a JSON object with a "hooks" key containing an array of strings. No markdown, no explanation.`;

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
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
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
