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
    const { hook_text, product_id, slide_count: requestedCount, soft_cta, copy_length = "long", carousel_style = "random" } = await req.json();

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

    // Carousel narrative frameworks — randomly pick one if "random"
    const CAROUSEL_STYLES = ["tips_list", "story_arc", "myth_busting", "before_after", "open_loop"] as const;
    const VALID_STYLES = new Set<string>(CAROUSEL_STYLES);
    let selectedStyle = carousel_style === "random"
      ? CAROUSEL_STYLES[Math.floor(Math.random() * CAROUSEL_STYLES.length)]
      : carousel_style;
    if (!VALID_STYLES.has(selectedStyle)) {
      console.warn(`Unknown carousel_style: "${selectedStyle}", defaulting to tips_list`);
      selectedStyle = "tips_list";
    }

    const styleInstructions: Record<string, string> = {
      tips_list: `CAROUSEL STYLE: Tips List
- Classic numbered list format. Each slide is one standalone tip.
- Escalate quality: start with the most accessible tip, build to the most surprising.
- Each slide should be screenshot-worthy on its own.
- Arc: relatable setup → practical middle → mind-blowing closer`,

      story_arc: `CAROUSEL STYLE: Story Arc (Star-Story-Solution)
- Slides tell a personal story with a narrative arc.
- Slide 1-2: set the scene, the struggle, the "before" state.
- Slide 3-4: the turning point, what changed, the discovery.
- Slide 5+: the result, the lesson, what you'd tell your past self.
- Each slide should make the reader think "and then what happened?"`,

      myth_busting: `CAROUSEL STYLE: Myth Busting / Contrarian
- Each slide challenges a common belief or "obvious" advice.
- Format: the myth ("everyone says X") → the reality ("but actually Y") → what to do instead.
- Be provocative but backed by specifics. Not contrarian for shock value.
- The reader should finish thinking "wait, i've been doing this wrong"`,

      before_after: `CAROUSEL STYLE: Before/After Transformation
- Slides alternate between "what i used to do" and "what i do now"
- Paint the "before" vividly so the reader sees themselves in it.
- The "after" should feel achievable, not aspirational-influencer.
- Build toward the biggest transformation on the later slides.`,

      open_loop: `CAROUSEL STYLE: Open Loop / Cliffhanger
- Each slide opens a mini curiosity gap that the NEXT slide closes.
- End slides mid-thought: "and the one thing that changed it all was..."
- Use phrases like "but here's what most people miss" as transitions.
- The reader should feel compelled to swipe because they NEED the resolution.
- Close all loops by the final slide. Never leave the reader hanging.`,
    };

    // Product placement follows Two-Thirds Rule from research
    const productSlideIndex = Math.max(1, Math.round(slide_count * 0.67));
    const productRule = productName
      ? `\nPRODUCT PLACEMENT (Two-Thirds Rule — MANDATORY):
- Slide ${productSlideIndex} (roughly 2/3 through) should naturally mention "${productName}" in the action line.
- Use "discovered it" framing: "stumbled on ${productName}," "someone recommended ${productName} to me," "finally found ${productName} and it clicked"
- Include a hedge for authenticity: "it's not perfect but," "honestly didn't expect this to work," "i was skeptical at first"
- If the carousel has ${slide_count} slides, the product appears on slide ${productSlideIndex}. NOT on slide 1, 2, or 3.
- ALL other slides: zero product mentions. Just genuinely useful standalone advice.
- If slide ${productSlideIndex} does NOT contain "${productName}", the output is WRONG.`
      : `\nPRODUCT RULE: Do NOT mention any product, app, or tool name. Every action line = real-world advice.`;

    const systemPrompt = `You write viral TikTok slideshow carousel copy. Your writing sounds like a real person sharing what genuinely worked for them. Not a marketer. Not an influencer. A friend who figured something out.

Hook: "${hook_text}"
${productName ? `Product: ${productName} — ${productDescription}` : ""}

SLIDE COUNT: Generate EXACTLY ${slide_count} body slides.${hookNumber ? ` The hook says "${hookNumber}" — match it exactly.` : ""}

${styleInstructions[selectedStyle] || styleInstructions.tips_list}

VOICE (the "texting a smart friend" system):
- all lowercase always. no capitals anywhere.
- first person "i" perspective throughout.
- contractions always ("don't" not "do not", "it's" not "it is").
- start at least one slide with "so," "ok," "honestly," or "the thing is"
- include one parenthetical aside: "(seriously, this one changed everything)"
- fragment sentences encouraged: "the result? wild." / "game over."
- include one hedging/vulnerability moment: "not gonna lie, this took me a while"
- NEVER use em dashes. periods or commas only.
- phonetic emphasis okay sparingly: "sooo much better"

SPECIFICITY RULES (most important — this is what separates viral from generic):
1. Replace every abstract noun with a concrete object ("hydration" → "a 40oz bottle on your desk")
2. Every tip must include at least ONE of: a number, a time, an object, or a named method
3. Replace adjectives with details: "great routine" → "the 5:30am cold water trick"
4. Always pair "what to do" with "how specifically to do it"
5. Use odd specific numbers ($37 not $40, 11 days not 2 weeks, 3 items not "a few")
6. If a tip could apply to any audience, narrow it with a situation or identity marker

STRUCTURE — each slide has 3 text fields:
${copy_length === "long" ? `1. "title" — numbered point or section label. 5-10 words. the micro-hook people read first.
2. "subtitle" — the relatable struggle or context. 15-25 words. make the reader think "that's literally me."
3. "action" — what they actually did. concrete, specific, useful. 15-25 words. someone could act on this today.
Total per slide: 35-60 words max. one clear point only.` : `1. "title" — numbered point. 3-8 words. punchy.
2. "subtitle" — the relatable pain point. max 12 words.
3. "action" — what they did. specific and useful. max 14 words.
Total per slide: max 34 words.`}
${productRule}

NARRATIVE TENSION:
- Slide 1 must re-hook (Instagram shows slide 2 to users who skip the hook slide)
- Include at least one open loop closed 1-2 slides later ("but here's the thing...")
- Escalate tip quality: most accessible first → most surprising last
- Include one "pattern interrupt" slide: "but here's what most people miss..."
- At least 2 slides must be screenshot-worthy as standalone images

SAVE-WORTHINESS:
- Design for saves first (saves are weighted 3x higher than likes by algorithms)
- Include at least one slide with a concrete framework, ratio, or checklist
- Final body slide should be "the one that matters most" summary

BANNED WORDS: chaos, clarity, aligned, reclaim, journey, unlock, elevate, transform, empower, optimize, leverage, game-changer, hack (unless literally about hacking)

EXAMPLE (reference only):
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

    // Post-generation fix: ensure product name appears at Two-Thirds position
    // Recompute from actual slide count (model may return fewer than requested)
    if (productName && slides.length > 0) {
      const actualProductIdx = Math.max(0, Math.round(slides.length * 0.67) - 1);
      const targetIdx = Math.min(actualProductIdx, slides.length - 1);
      const targetSlide = slides[targetIdx] as Record<string, unknown>;
      const action = String(targetSlide.action ?? "");
      if (!action.toLowerCase().includes(productName.toLowerCase())) {
        // Inject a natural mention — keep the existing action and weave in the product
        const fallbacks = [
          `someone put me on ${productName} and i haven't looked back since`,
          `i stumbled on ${productName} and it clicked almost immediately`,
          `honestly ${productName} is the thing that finally made this work for me`,
        ];
        targetSlide.action = fallbacks[Math.floor(Math.random() * fallbacks.length)];
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
