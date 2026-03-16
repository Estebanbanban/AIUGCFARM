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
        // Clean product name: strip taglines, HTML entities, pipe separators
        let rawName = product.name ?? "";
        rawName = rawName.replace(/&amp;/g, "&").replace(/&#\d+;/g, "");
        rawName = rawName.split("|")[0].split("–")[0].split("-")[0].trim();
        rawName = rawName.replace(/#\d+\s*/g, "").trim();
        productName = rawName.toLowerCase();
        productDescription = product.description ?? "";
      }
    }

    const topicContext = productName
      ? `${productName} - ${productDescription}`
      : (niche ?? "general lifestyle");

    const systemPrompt = `You are a viral carousel hook generator. Your hooks appear on the first slide of Pinterest-style aesthetic photo carousels on TikTok Photo Mode and Instagram.

Topic: ${topicContext}
${niche ? `Niche: ${niche}` : ""}
${productName ? `Product: ${productName} — ${productDescription}\n2-3 hooks should naturally reference "${productName}" (e.g. "5 things i learned after trying ${productName} for a month:"). The rest should focus on the broader topic.` : ""}

Generate ${count} hooks. Each hook MUST use a DIFFERENT pattern from this list (rotate through them, never repeat the same pattern twice in a row):

HOOK PATTERNS (use all of these across your ${count} hooks):
1. Discovery late: "i can't believe i just found out about this" / "why did nobody tell me"
2. Empathy mirror: "[exact internal monologue of target audience]..."
3. Specific transformation: "i [changed one thing] and [specific measurable result]"
4. Contrarian challenge: "everything you know about [topic] is wrong"
5. Gatekeeping reveal: "the [thing] nobody is talking about"
6. Loss-framed problem: "you're doing [X] wrong and it's costing you [specific loss]"
7. Authority insider: "as a [profession], i'm begging you to stop [common mistake]"
8. Regret discovery: "i wish someone told me this [timeframe] ago"
9. Identity call-out: "for my [specific identity] who [specific situation]"
10. Vulnerability flip: "i [bad thing happened]... here's what i did next"

HARD RULES:
- Maximum 10 words per hook (absolute max 12). must be readable in 0.3 seconds while scrolling.
- ALL lowercase. no title case. no ALL CAPS.
- first person "i" perspective always. discovery framing, not prescriptive.
- must contain at least ONE psychological trigger: curiosity gap, loss aversion, identity, pattern interrupt, or social proof.
- include emotional intensifiers where natural: "genuinely," "literally," "actually," "honestly"
- include temporal markers where natural: "just," "finally," "until now," "after [timeframe]"
- use odd specific numbers over round ones (7 not 5, $3,247 not $3,000, 11 days not 2 weeks)
- end each hook with a colon (the slides continue the thought)
- NEVER use em dashes, exclamation marks, or the word "best"
- NEVER use: chaos, clarity, aligned, reclaim, journey, unlock, elevate, transform, empower, optimize, leverage, game-changer
- each hook must pass the "text message test": read it aloud, would you text this to a friend?
- each hook must create an open loop the viewer can ONLY close by swiping

NICHE ADAPTATION:
- E-commerce: discovery energy. "i just found the perfect..." / "ok this actually works"
- Wellness/fitness: transformation + credibility. include "realistic" qualifiers.
- Finance: specific $ amounts + timeframes. numbers create credibility.
- Lifestyle/productivity: aesthetic revelation. "changed my life" / "replaced my entire"
- Education/career: insider knowledge. "what they don't teach you" / "the thing nobody mentions about"

EXAMPLES (reference only, write original ones):
- "5 things i stopped doing after i burned out at 26:"
- "i tracked every dollar i spent for 30 days and the results made me sick:"
- "my therapist said something that broke my brain:"
- "i've been a recruiter for 7 years and i'm begging you to stop doing this:"
- "the $4 hack luxury hotels don't want you to know about:"
- "4 mistakes that cost me $20k my first year freelancing:"

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
