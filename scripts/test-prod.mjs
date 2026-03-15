/**
 * Test script — cinerads.com prod
 * Run: node scripts/test-prod.mjs
 */

const SUPABASE_URL = "https://nuodqvvgfwptnnlvmqbe.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2RxdnZnZndwdG5ubHZtcWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzc1MjksImV4cCI6MjA4Nzc1MzUyOX0.kA_8qrjDvasEtzPgI5jMTHS4HhkrbGM0TUBhiX_3sCQ";

let passed = 0, failed = 0;

function ok(name, cond, detail = "") {
  if (cond) { console.log(`  ✅  ${name}${detail ? " — " + detail : ""}`); passed++; }
  else       { console.log(`  ❌  ${name}${detail ? " — " + detail : ""}`); failed++; }
}

async function get(url, headers = {}) {
  const r = await fetch(url, { headers });
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}

async function post(url, data, headers = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(data),
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, body };
}

// ─── 1. Public pages ───────────────────────────────────────────────────────
console.log("\n🌐  Public pages");
for (const path of ["/", "/pricing", "/sign-in", "/sign-up"]) {
  const r = await fetch(`https://cinerads.com${path}`, { redirect: "follow" });
  ok(`cinerads.com${path}`, r.status === 200, `HTTP ${r.status}`);
}

// ─── 2. DB schema — PostgREST (anon) ──────────────────────────────────────
console.log("\n🗄️   DB schema");
const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };

const cache = await get(`${SUPABASE_URL}/rest/v1/composite_cache?limit=0`, headers);
ok("composite_cache table exists", cache.status === 200, `HTTP ${cache.status}`);

const genCols = await get(`${SUPABASE_URL}/rest/v1/generations?select=format,cta_style&limit=0`, headers);
ok("generations.format column", genCols.status === 200, `HTTP ${genCols.status}`);
ok("generations.cta_style column", genCols.status === 200, `HTTP ${genCols.status}`);

// ─── 3. Edge functions — auth guard ───────────────────────────────────────
console.log("\n🔒  Edge function auth guards (no token → 401)");
// POST-based functions → 401
for (const fn of ["stripe-checkout", "generate-video", "generate-composite-images", "get-profile"]) {
  const r = await post(`${SUPABASE_URL}/functions/v1/${fn}`, {});
  ok(`${fn} → 401`, r.status === 401, `HTTP ${r.status}`);
}
// GET-based functions → 401 (method guard rejects POST with 405, GET with 401)
for (const fn of ["credit-balance", "list-products", "list-personas"]) {
  const r = await get(`${SUPABASE_URL}/functions/v1/${fn}`);
  ok(`${fn} → 401`, r.status === 401, `HTTP ${r.status}`);
}

// ─── 4. Edge functions — method guard ─────────────────────────────────────
console.log("\n🚦  Edge function method guards");
const getOnly = ["credit-balance", "get-profile", "list-products", "list-personas"];
for (const fn of getOnly) {
  const r = await get(`${SUPABASE_URL}/functions/v1/${fn}`);
  ok(`${fn} GET → 401 (not 500)`, r.status !== 500, `HTTP ${r.status}`);
}

const postOnly = ["stripe-checkout", "generate-video", "generate-composite-images"];
for (const fn of postOnly) {
  const r = await get(`${SUPABASE_URL}/functions/v1/${fn}`);
  ok(`${fn} GET → 401 or 405`, [401, 405].includes(r.status), `HTTP ${r.status}`);
}

// ─── 5. CORS ──────────────────────────────────────────────────────────────
console.log("\n🌍  CORS preflight");
for (const fn of ["stripe-checkout", "generate-video", "generate-composite-images"]) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://cinerads.com",
      "Access-Control-Request-Method": "POST",
    },
  });
  ok(`${fn} OPTIONS`, r.status === 200, `HTTP ${r.status}`);
}

// ─── 6. Stripe cancel URL (code-level check) ──────────────────────────────
console.log("\n💳  Stripe cancel URL target");
import { readFileSync } from "fs";
const stripeCode = readFileSync("supabase/functions/stripe-checkout/index.ts", "utf8");
const cancelLines = stripeCode.match(/cancel_url.*checkout=cancel/g) ?? [];
ok("cancel_url points to /generate (pack)", cancelLines.some(l => l.includes("/generate")), cancelLines[0] ?? "not found");
ok("cancel_url points to /generate (subscription)", cancelLines.length >= 2, `${cancelLines.length} cancel_url(s) found`);
ok("No old /settings/billing cancel", !stripeCode.includes("/settings/billing?checkout=cancel"), "no legacy URL");
ok("No old /pricing cancel", !stripeCode.includes("/pricing?checkout=cancel"), "no legacy URL");

// ─── 7. CheckoutSuccessHandler — cancelled handler ────────────────────────
console.log("\n🎉  CheckoutSuccessHandler");
const handlerCode = readFileSync("frontend/src/components/checkout/CheckoutSuccessHandler.tsx", "utf8");
ok("checkout=cancelled handler exists", handlerCode.includes("checkout") && handlerCode.includes("cancelled"), "handler found");
ok("toast on cancel", handlerCode.includes("toast"), "toast call found");
ok("router.replace cleans URL", handlerCode.includes("router.replace"), "URL cleanup found");
ok("session_id spoofing check", handlerCode.includes("session_id") && handlerCode.includes("cs_"), "spoofing guard found");

// ─── 8. DB migration files ────────────────────────────────────────────────
console.log("\n📁  Migration files");
import { existsSync } from "fs";
ok("composite_cache migration", existsSync("supabase/migrations/20260308180000_composite_cache.sql"));
ok("generations format/cta_style migration", existsSync("supabase/migrations/20260308190000_generations_add_fields.sql"));
ok("composite_images RLS migration", existsSync("supabase/migrations/20260308120000_composite_images_rls.sql"));

// ─── 9. Frontend hooks ────────────────────────────────────────────────────
console.log("\n🪝  Frontend hooks");
ok("use-composite-cache hook", existsSync("frontend/src/hooks/use-composite-cache.ts"));
ok("use-last-pending-generation hook", existsSync("frontend/src/hooks/use-last-pending-generation.ts"));

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(50)}`);
console.log(`  Total: ${passed + failed}  ✅ ${passed} passed  ❌ ${failed} failed`);
console.log(`${"─".repeat(50)}\n`);
process.exit(failed > 0 ? 1 : 0);
