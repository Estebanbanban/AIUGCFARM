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
    const { hook_text, product_id, slide_count: requestedCount, soft_cta, copy_length = "long" } = await req.json();

    if (!hook_text || typeof hook_text !== "string") {
      return json({ detail: "hook_text is required" }, cors, 400);
    }

    // Extract the first number from the hook text (e.g. "5 things i..." or "here are 6 ways..." → 5/6)
    // Use that as slide_count if the caller didn't specify one
    const hookNumberMatch = hook_text.match(/\b(\d+)\b/);
    const hookNumber = hookNumberMatch ? parseInt(hookNumberMatch[1], 10) : null;
    const slide_count = requestedCount ?? hookNumber ?? 4;

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
        // Clean product name: strip taglines, HTML entities, pipe separators
        // "Road to Offer | #1 AI Platform for McKinsey, BCG &amp; Bain" → "road to offer"
        let rawName = product.name ?? "";
        rawName = rawName.replace(/&amp;/g, "&").replace(/&#\d+;/g, "");
        rawName = rawName.split("|")[0].split("–")[0].split("-")[0].trim();
        rawName = rawName.replace(/#\d+\s*/g, "").trim();
        productName = rawName.toLowerCase();
        productDescription = product.description ?? "";
      }
    }

    const productRule = productName
      ? `\nPRODUCT MENTION:
- ONLY the LAST slide (slide ${slide_count}) may casually mention "${productName}" in the action line.
- Use ONLY the short name "${productName}" — never the full title, tagline, or description.
- Make it feel like a friend's recommendation, not an ad. Examples:
  - "i started using ${productName} and it clicked"
  - "someone put me on ${productName} and i wish i'd found it sooner"
- Slides 1 through ${slide_count - 1}: NO product mentions. Just real advice.`
      : `\nPRODUCT RULE: Do NOT mention any product, app, or tool name. Every action line should be real-world advice.`;

    const systemPrompt = `You write TikTok slideshow carousel copy. Your writing sounds like a real person sharing what actually worked for them. Not a marketer. Not an influencer. A friend who figured something out and is telling you about it over coffee.

Hook: "${hook_text}"
${productName ? `Product being promoted: ${productName} — ${productDescription}` : ""}

SLIDE COUNT (CRITICAL): Generate EXACTLY ${slide_count} body slides. Not ${slide_count - 1}, not ${slide_count + 1}. Exactly ${slide_count}.
${hookNumber ? `The hook says "${hookNumber}" — you MUST produce exactly ${hookNumber} slides to match.` : ""}

VOICE & TONE:
- Write like you're texting your smartest friend. Casual but sharp.
- Be opinionated. Take a stance. "this changed everything" > "this might help"
- Be specific. Real numbers, real actions, real situations. Never vague.
- Slightly unfiltered. A little raw. The kind of post people screenshot and send to friends.
- Short punchy sentences. No filler. Every word earns its spot.

STRUCTURE — each slide has 3 text fields:
${copy_length === "long" ? `1. "title" — numbered point. Format: "[n]. [specific action or insight]" — 8-14 words. This is the headline people read first.
2. "subtitle" — the relatable struggle or context. What was going wrong before. 12-20 words. Make the reader think "that's literally me."
3. "action" — what they actually did. Concrete, specific, no fluff. 14-22 words. This should be genuinely useful advice someone could act on today.` : `1. "title" — numbered point. Format: "[n]. [short punchy takeaway]" — Max 8 words.
2. "subtitle" — the relatable pain point. Max 12 words.
3. "action" — what they did about it. Specific and useful. Max 14 words.`}
${productRule}

HARD RULES:
- ALL lowercase always. no capitals anywhere.
- first person "i" perspective throughout.
- NEVER use em dashes (—). use periods or commas instead.
- NEVER use these words: chaos, clarity, aligned, reclaim, journey, unlock, elevate, transform, empower, optimize, leverage, game-changer
- each slide should give genuinely good advice. if someone only read that one slide they should still learn something useful.
- the slides tell a story. there's a progression. slide 1 sets up the problem, middle slides build momentum, last slide pays it off.
- be original. no generic self-help platitudes. write something someone hasn't heard before.

EXAMPLE (for reference, don't copy):
{ "type": "body", "title": "1. i stopped eating lunch at my desk", "subtitle": "i was answering slack messages between bites and wondering why i was exhausted by 2pm", "action": "now i eat outside with my phone in my bag. 20 minutes. my afternoons are completely different.", "order": 1 }

Output ONLY a JSON object: { "slides": [{ "type": "body", "title": "...", "subtitle": "...", "action": "...", "order": 1 }, ...] }`;

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

    // Post-generation fix: ensure product name is in the last slide's action
    if (productName && slides.length > 0) {
      const lastSlide = slides[slides.length - 1] as Record<string, unknown>;
      const action = String(lastSlide.action ?? "");
      if (!action.toLowerCase().includes(productName.toLowerCase())) {
        // Force-inject the product mention into the last slide's action
        lastSlide.action = `i found ${productName} and it honestly made this so much easier. worth trying if you're stuck.`;
      }
    }

    return json({ data: { slides } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") return json({ detail: "Unauthorized" }, cors, 401);
    console.error("generate-slide-copy error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
