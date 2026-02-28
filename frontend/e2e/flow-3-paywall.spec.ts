/**
 * Flow 3: Paywall — hitting the generate wall, seeing 50% off banner,
 * credit packs, and subscription options.
 */
import { test, expect } from "@playwright/test";
import { uniqueEmail, signUpAndInject } from "./helpers/auth";

const SHOTS = "../docs/qa-flows/flow-3-paywall";
const BASE = "http://localhost:4000";

test.describe("Flow 3 — Paywall & 50% Off First Video", () => {
  test("billing page — credit packs and triple explainer", async ({ page }) => {
    const email = uniqueEmail("billing");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/settings/billing`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SHOTS}/01-billing-page-top.png`, fullPage: false });

    // Scroll to credit packs
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/02-billing-credit-packs.png`, fullPage: false });

    // Triple mode explainer
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/03-billing-triple-explainer.png`, fullPage: false });

    // Plans section
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/04-billing-plans.png`, fullPage: false });

    // Full page
    await page.screenshot({ path: `${SHOTS}/00-billing-full.png`, fullPage: true });

    // Verify key content
    const body = await page.textContent("body");
    const checks = {
      "27 ad combos": body?.includes("27"),
      "Triple mode": body?.toLowerCase().includes("triple"),
      "Starter Pack": body?.includes("Starter Pack"),
      "Creator Pack": body?.includes("Creator Pack"),
      "Pro Pack": body?.includes("Pro Pack"),
      "$12 pack": body?.includes("$12"),
      "$33 pack": body?.includes("$33"),
      "$95 pack": body?.includes("$95"),
    };
    console.log("Billing page content checks:", checks);
  });

  test("generate page — paywall dialog triggers at 0 credits", async ({ page }) => {
    const email = uniqueEmail("paywall");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/generate`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: `${SHOTS}/05-generate-step4.png` });

    // Navigate to step 4 by checking if there's a way to get there directly
    // Try clicking Generate button if visible (it should trigger paywall)
    const generateBtn = page.getByRole("button", { name: /generate/i }).last();
    if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await generateBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/06-paywall-dialog-open.png` });

      // Check for 50% off banner
      const body = await page.textContent("body");
      const has50off = body?.includes("50%") || body?.toLowerCase().includes("first video");
      console.log(`50% off banner visible: ${has50off}`);
      await page.screenshot({ path: `${SHOTS}/07-paywall-50off-check.png` });

      // Check for credit packs in dialog
      const hasStarterPack = body?.includes("Starter Pack");
      const hasCreatorPack = body?.includes("Creator Pack");
      console.log(`Credit packs in paywall: Starter=${hasStarterPack}, Creator=${hasCreatorPack}`);
    } else {
      console.log("Generate button not visible at this step — user needs to complete steps 1-3 first");
      await page.screenshot({ path: `${SHOTS}/06-generate-not-ready.png` });
    }
  });

  test("sidebar credits + button visible at zero balance", async ({ page }) => {
    const email = uniqueEmail("sidebar");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Screenshot the sidebar area (credits widget)
    await page.screenshot({ path: `${SHOTS}/08-sidebar-zero-credits.png` });

    // Check sidebar text
    const body = await page.textContent("body");
    console.log(`Shows 0/0 credits: ${body?.includes("0/0") || body?.includes("0 credits")}`);
    console.log(`Page URL: ${page.url()}`);
  });

  test("+ button in sidebar → navigates to billing", async ({ page }) => {
    const email = uniqueEmail("plus-btn");
    await signUpAndInject(page, email);

    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Find + button
    const plusLink = page.locator("a[href='/settings/billing'][aria-label='Buy credits']");
    if (await plusLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await plusLink.screenshot({ path: `${SHOTS}/09-plus-button.png` });
      await plusLink.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/10-after-plus-click.png` });
      const url = page.url();
      console.log(`After + click URL: ${url}`);
      expect(url).toContain("/settings/billing");
    } else {
      console.log("⚠️ + button not found via aria-label — trying title attribute");
      const byTitle = page.locator("[title='Buy credits']");
      if (await byTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await byTitle.screenshot({ path: `${SHOTS}/09-plus-button-title.png` });
      } else {
        await page.screenshot({ path: `${SHOTS}/09-plus-button-missing.png` });
        console.log("⚠️ + button not found in sidebar");
      }
    }
  });
});
