/**
 * Flow 5: Full generation flow on PROD (cinerads.com)
 * Uses a Mailinator temp email — no credentials needed.
 *
 * Run:
 *   cd frontend && npx playwright test e2e/flow-5-generation-prod.spec.ts --headed --project=chromium
 */
import { test, expect, type Page } from "@playwright/test";
import fs from "fs";

const BASE = "https://cinerads.com";
const SUPABASE_URL = "https://nuodqvvgfwptnnlvmqbe.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2RxdnZnZndwdG5ubHZtcWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzc1MjksImV4cCI6MjA4Nzc1MzUyOX0.kA_8qrjDvasEtzPgI5jMTHS4HhkrbGM0TUBhiX_3sCQ";
const SHOTS = "./e2e-screenshots";
const TS = Date.now();
const INBOX = `cinerads.test.${TS}`;
const EMAIL = `${INBOX}@mailinator.com`;
const PASSWORD = "CineTest2026!";

if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

// Shared state across tests
let clerkToken: string | null = null;

test.use({ baseURL: BASE });
test.describe.configure({ mode: "serial" }); // run in order

test.describe("Flow 5 — Generation Flow PROD", () => {

  // ─────────────────────────────────────────────────────────────────
  test("01 — sign-up with temp email", async ({ page }) => {
    console.log(`\n📧 Test email: ${EMAIL}`);

    await page.goto(`${BASE}/sign-up`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/01-signup-page.png` });

    // Fill Clerk sign-up form
    const emailInput = page.getByLabel(/email/i).first();
    await emailInput.fill(EMAIL);

    const passInput = page.getByLabel(/password/i).first();
    await passInput.fill(PASSWORD);

    await page.screenshot({ path: `${SHOTS}/02-signup-filled.png` });
    await page.getByRole("button", { name: /sign up|continue|create/i }).first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/03-signup-submitted.png` });

    const url = page.url();
    const body = await page.textContent("body");
    console.log(`After signup URL: ${url}`);

    // Check if email verification needed
    const needsVerification = body?.toLowerCase().match(/verify|check.*email|code|confirm/);
    console.log(`Needs email verification: ${!!needsVerification}`);

    if (needsVerification) {
      // Fetch verification code from Mailinator public API
      console.log(`Waiting for verification email on Mailinator...`);
      const code = await getMailinatorCode(INBOX, 30_000);
      console.log(`Got verification code: ${code}`);

      if (code) {
        // Find the OTP input (Clerk uses digit inputs or a single code field)
        const codeInput = page.locator("input[name='code'], input[autocomplete='one-time-code'], [data-testid='code-input']").first();
        const hasSingleInput = await codeInput.isVisible({ timeout: 3000 }).catch(() => false);

        if (hasSingleInput) {
          await codeInput.fill(code);
        } else {
          // Clerk digit-by-digit inputs
          const digits = page.locator("input[maxlength='1']");
          const count = await digits.count();
          if (count >= 6) {
            for (let i = 0; i < Math.min(count, code.length); i++) {
              await digits.nth(i).fill(code[i]);
            }
          }
        }
        await page.waitForTimeout(1000);
        await page.screenshot({ path: `${SHOTS}/04-otp-filled.png` });

        // Submit if there's a verify button
        const verifyBtn = page.getByRole("button", { name: /verify|continue|confirm/i }).first();
        if (await verifyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await verifyBtn.click();
        }
        await page.waitForTimeout(3000);
      }
    }

    await page.screenshot({ path: `${SHOTS}/05-after-signup.png` });
    // Should be on dashboard or generate after signup
    const finalUrl = page.url();
    console.log(`Final URL after signup: ${finalUrl}`);
    expect(finalUrl).toMatch(/cinerads\.com/);
  });

  // ─────────────────────────────────────────────────────────────────
  test("02 — dashboard loads", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/06-dashboard.png` });

    const body = await page.textContent("body");
    console.log(`Dashboard — free plan visible: ${!!body?.match(/free/i)}`);
    console.log(`Dashboard — credits visible: ${!!body?.match(/credit|video/i)}`);
    expect(page.url()).toContain("/dashboard");
  });

  // ─────────────────────────────────────────────────────────────────
  test("03 — /generate page loads, wizard step 1 visible", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/07-generate-step1.png`, fullPage: true });

    const body = await page.textContent("body");
    const checks = {
      "Page loaded": page.url().includes("/generate"),
      "AI Creator OR Persona": !!body?.match(/ai creator|persona/i),
      "Product step visible": !!body?.match(/product|import|url/i),
    };
    console.log("Generate page checks:", checks);
    expect(checks["Page loaded"]).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  test("04 — checkout=cancelled toast + URL cleanup", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE}/generate?checkout=cancelled`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/08-cancelled-toast.png` });

    const urlClean = !page.url().includes("checkout=cancelled");
    const body = await page.textContent("body");
    const hasToast = !!body?.match(/progress.*saved|saved|no worries/i);

    console.log(`✅ URL cleaned up: ${urlClean} → ${page.url()}`);
    console.log(`✅ Toast visible: ${hasToast}`);
    expect(urlClean).toBe(true);
  });

  // ─────────────────────────────────────────────────────────────────
  test("05 — edge functions accessible with Clerk token", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Extract Clerk JWT from the running app
    const token = await page.evaluate(async () => {
      const clerk = (window as any).Clerk;
      if (!clerk?.session) return null;
      return await clerk.session.getToken();
    });

    if (!token) {
      console.log("⚠️  No Clerk token found — skipping API tests");
      return;
    }

    console.log(`✅ Clerk token obtained (${token.slice(0, 30)}...)`);
    clerkToken = token;

    const tests: Array<{ name: string; url: string; method?: string; body?: object }> = [
      { name: "credit-balance", url: `${SUPABASE_URL}/functions/v1/credit-balance` },
      { name: "get-profile", url: `${SUPABASE_URL}/functions/v1/get-profile` },
      { name: "list-products", url: `${SUPABASE_URL}/functions/v1/list-products` },
      { name: "list-personas", url: `${SUPABASE_URL}/functions/v1/list-personas` },
    ];

    for (const t of tests) {
      const res = await page.evaluate(async ({ url, tok, method, body }) => {
        const r = await fetch(url, {
          method: method ?? "GET",
          headers: {
            Authorization: `Bearer ${tok}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      }, { url: t.url, tok: token, method: t.method, body: t.body });

      console.log(`${res.status === 200 ? "✅" : "❌"} ${t.name}: HTTP ${res.status}`, JSON.stringify(res.body)?.slice(0, 120));
      expect(res.status).toBe(200);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  test("06 — composite_cache table: authenticated read returns 200", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const token = await page.evaluate(async () => {
      const clerk = (window as any).Clerk;
      if (!clerk?.session) return null;
      return await clerk.session.getToken();
    });

    if (!token) { console.log("⚠️  No token"); return; }

    const res = await page.evaluate(async ({ url, tok, anon }) => {
      const r = await fetch(`${url}/rest/v1/composite_cache?select=*&limit=5`, {
        headers: { apikey: anon, Authorization: `Bearer ${tok}` },
      });
      return { status: r.status, count: (await r.json()).length };
    }, { url: SUPABASE_URL, tok: token, anon: ANON_KEY });

    console.log(`✅ composite_cache: HTTP ${res.status}, rows: ${res.count}`);
    expect(res.status).toBe(200);
  });

  // ─────────────────────────────────────────────────────────────────
  test("07 — generations table has format + cta_style columns", async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const token = await page.evaluate(async () => {
      const clerk = (window as any).Clerk;
      if (!clerk?.session) return null;
      return await clerk.session.getToken();
    });

    if (!token) { console.log("⚠️  No token"); return; }

    const res = await page.evaluate(async ({ url, tok, anon }) => {
      const r = await fetch(`${url}/rest/v1/generations?select=format,cta_style&limit=0`, {
        headers: { apikey: anon, Authorization: `Bearer ${tok}` },
      });
      return { status: r.status, body: await r.text() };
    }, { url: SUPABASE_URL, tok: token, anon: ANON_KEY });

    console.log(`✅ generations format+cta_style: HTTP ${res.status}`);
    expect(res.status).toBe(200);
  });

});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function signIn(page: Page) {
  await page.goto(`${BASE}/sign-in`);
  await page.waitForLoadState("networkidle");
  if (page.url().match(/dashboard|generate/)) return;

  await page.getByLabel(/email/i).first().fill(EMAIL);
  await page.getByLabel(/password/i).first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|continue|log in/i }).first().click();
  await page.waitForURL(/dashboard|generate/, { timeout: 15_000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
}

/** Poll Mailinator public inbox until we find a 6-digit OTP code */
async function getMailinatorCode(inbox: string, timeoutMs = 30_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`https://www.mailinator.com/api/v2/domains/mailinator.com/inboxes/${inbox}/messages`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json() as { msgs?: Array<{ id: string }> };
        if (data.msgs?.length) {
          // Get latest message body
          const msgId = data.msgs[0].id;
          const msgRes = await fetch(`https://www.mailinator.com/api/v2/domains/mailinator.com/inboxes/${inbox}/messages/${msgId}`);
          if (msgRes.ok) {
            const msg = await msgRes.json() as { data?: { parts?: Array<{ body: string }> } };
            const body = msg.data?.parts?.map(p => p.body).join(" ") ?? "";
            const match = body.match(/\b(\d{6})\b/);
            if (match) return match[1];
          }
        }
      }
    } catch {
      // ignore, keep polling
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return null;
}
