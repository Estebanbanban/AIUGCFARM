/**
 * Flow 2: Signup → Product import → Persona creation → Composite image preview
 * Tests the full free onboarding path up to the generate paywall.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUpAndInject } from "./helpers/auth";

const SHOTS = "../docs/qa-flows/flow-2-onboarding";
const BASE = "http://localhost:4000";

test.describe("Flow 2 — Signup & Onboarding", () => {
  test("signup form submission", async ({ page }) => {
    await page.goto(`${BASE}/signup`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/01-signup-empty.png` });

    const email = uniqueEmail("signup");
    const emailInput = page.getByPlaceholder(/email/i).or(page.getByLabel(/email/i)).first();
    const passInput = page.getByPlaceholder(/password/i).or(page.getByLabel(/password/i)).first();

    await emailInput.fill(email);
    await passInput.fill("TestPass123!");
    await page.screenshot({ path: `${SHOTS}/02-signup-filled.png` });

    await page.getByRole("button", { name: /sign up|create|get started/i }).first().click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${SHOTS}/03-signup-submitted.png` });

    const url = page.url();
    console.log(`After signup: ${url}`);

    // Check for confirmation message or redirect to dashboard/confirm email
    const pageText = await page.textContent("body");
    console.log(`Page contains 'confirm': ${pageText?.includes("confirm")}`);
    console.log(`Page contains 'dashboard': ${pageText?.includes("dashboard")}`);
  });

  test("injected session → dashboard", async ({ page }) => {
    const email = uniqueEmail("dash");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/04-dashboard-new-user.png` });

    const url = page.url();
    console.log(`Dashboard URL: ${url}`);

    // If redirected to login, auth injection didn't work
    if (url.includes("login")) {
      console.log("AUTH ISSUE: redirected to login despite injected session");
    }
  });

  test("generate page — step 1 product (no products yet)", async ({ page }) => {
    const email = uniqueEmail("gen-step1");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/05-generate-step1-empty.png` });

    // Should see product import form
    const pageText = await page.textContent("body");
    console.log(`Has 'import': ${pageText?.toLowerCase().includes("import")}`);
    console.log(`Has 'product': ${pageText?.toLowerCase().includes("product")}`);
    console.log(`Current URL: ${page.url()}`);
  });

  test("generate page — product import via URL", async ({ page }) => {
    const email = uniqueEmail("import");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/06-product-import-form.png` });

    // Try to fill in a product URL
    const urlInput = page.getByPlaceholder(/https.*store|product.*url|url/i).first();
    if (await urlInput.isVisible()) {
      await urlInput.fill("https://www.amazon.com/dp/B08N5WRWNW");
      await page.screenshot({ path: `${SHOTS}/07-product-url-filled.png` });
    } else {
      console.log("No URL input found — checking for other import options");
      await page.screenshot({ path: `${SHOTS}/07-no-url-input.png` });
    }
  });

  test("generate page — step 2 persona (sidebar + button)", async ({ page }) => {
    const email = uniqueEmail("persona");
    await signUpAndInject(page, email);

    // First navigate to dashboard to check sidebar credit display
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/08-sidebar-credits-zero.png` });

    // Check + button next to credits
    const plusBtn = page.getByRole("link", { name: /buy credits/i }).or(
      page.locator("[aria-label='Buy credits']")
    );
    if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ + button visible next to credits");
    } else {
      console.log("⚠️ + button not found in sidebar");
    }
  });
});
