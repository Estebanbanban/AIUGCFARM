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
    const { hook_text, product_id, slide_count = 4, soft_cta, copy_length = "long" } = await req.json();

    if (!hook_text || typeof hook_text !== "string") {
      return json({ detail: "hook_text is required" }, cors, 400);
    }

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

    const productMention = soft_cta && productName
      ? `\nPRODUCT MENTION RULE (CRITICAL):
- ONLY the LAST slide (slide ${slide_count}) may mention "${productName}" in its action line — as a natural recommendation, not an ad.
- ALL OTHER slides MUST NOT mention "${productName}" or any product/app/tool name. Their action lines should describe generic real-world actions (what "I" physically did — not what app I used).
- If you mention the product on more than one slide, the output is WRONG.`
      : `\nPRODUCT MENTION RULE: Do NOT mention any specific product, app, or tool name in any slide. Keep all action lines about real-world actions.`;

    const systemPrompt = `Generate slide text for a TikTok slideshow carousel.

Hook (first slide text): ${hook_text}
${productName ? `Product context (for reference only): ${productName} - ${productDescription}` : ""}
Number of body slides to generate: ${slide_count}

Each body slide has THREE text elements:
${copy_length === "long" ? `1. "title" — a numbered point (the main takeaway). Format: "[number]. [detailed action statement]" — 8-14 words. Be specific and descriptive.
2. "subtitle" — the relatable complaint/context. What the person was struggling with. 12-20 words. Paint a picture.
3. "action" — what they actually did about it. A real action, not a product pitch. 14-22 words.` : `1. "title" — a numbered point (the main takeaway). Format: "[number]. [short action statement]" — Max 8 words.
2. "subtitle" — the relatable complaint/context. What the person was struggling with. Max 12 words.
3. "action" — the specific simple thing they did to fix it. Max 14 words.`}
${productMention}

Rules:
- ALL lowercase, no capitalization anywhere
- First person "I" perspective
- Sound like texting a friend, not captioning an Instagram post
- 7th grade reading level — simple words, short sentences
- No motivational-poster words: "chaos", "clarity", "aligned", "reclaim", "journey"
- Be specific, not generic. Real actions, not vibes.
- Each slide builds on the previous — there should be a narrative arc
- The action lines should feel like real things a person did, NOT like app store descriptions

Output ONLY a JSON object with a "slides" key containing an array of objects: [{ "type": "body", "title": "...", "subtitle": "...", "action": "...", "order": 1 }]`;

    const userPrompt = `Generate ${slide_count} body slides for the hook: "${hook_text}"`;

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

    // Parse the slides array from the response
    let cleaned = content.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const slides: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.slides)
        ? parsed.slides
        : [];

    if (slides.length === 0) {
      throw new Error("No slides generated");
    }

    return json({ data: { slides } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("generate-slide-copy error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
