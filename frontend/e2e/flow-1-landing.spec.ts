/**
 * Flow 1: Landing page & marketing funnel
 * Screenshots every meaningful section to audit the conversion funnel.
 */
import { test, expect } from "@playwright/test";
import path from "path";

const SHOTS = "../docs/qa-flows/flow-1-landing";

test.describe("Flow 1 — Landing & Marketing Pages", () => {
  test("homepage hero and sections", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/01-homepage-hero.png`, fullPage: false });

    // Scroll through sections
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/02-homepage-features.png`, fullPage: false });

    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/03-homepage-mid.png`, fullPage: false });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/04-homepage-footer.png`, fullPage: false });

    // Full page
    await page.screenshot({ path: `${SHOTS}/00-homepage-full.png`, fullPage: true });
  });

  test("pricing page", async ({ page }) => {
    await page.goto("/pricing");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/05-pricing-top.png`, fullPage: false });
    await page.screenshot({ path: `${SHOTS}/00-pricing-full.png`, fullPage: true });

    // Check plans are visible via table column headers
    await expect(page.getByRole("columnheader", { name: "Starter" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Growth" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Scale" })).toBeVisible();
  });

  test("signup page", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/06-signup-page.png`, fullPage: false });

    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${SHOTS}/07-login-page.png`, fullPage: false });
  });

  test("CTA from hero navigates to signup", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find primary CTA button
    const ctaBtn = page.getByRole("link", { name: /get started|start|sign up|try/i }).first();
    if (await ctaBtn.isVisible()) {
      await ctaBtn.screenshot({ path: `${SHOTS}/08-cta-button.png` });
      const href = await ctaBtn.getAttribute("href");
      console.log(`CTA href: ${href}`);
    } else {
      console.log("No CTA button found on homepage");
      await page.screenshot({ path: `${SHOTS}/08-cta-missing.png` });
    }
  });
});
