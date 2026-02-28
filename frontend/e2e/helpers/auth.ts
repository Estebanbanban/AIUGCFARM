import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const SUPABASE_URL = "https://nuodqvvgfwptnnlvmqbe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2RxdnZnZndwdG5ubHZtcWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzc1MjksImV4cCI6MjA4Nzc1MzUyOX0.kA_8qrjDvasEtzPgI5jMTHS4HhkrbGM0TUBhiX_3sCQ";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2RxdnZnZndwdG5ubHZtcWJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE3NzUyOSwiZXhwIjoyMDg3NzUzNTI5fQ.la7L5epIEuMQeLvig6KBWLrV7YV684gyUUNG5xQzJyQ";

export function uniqueEmail(label: string) {
  const ts = Date.now();
  return `aiugc.test.${label}.${ts}@mailinator.com`;
}

/** Create a confirmed test user via admin API (bypasses email confirmation). */
export async function createTestUser(email: string, password = "TestPass123!") {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email confirmation
  });
  if (error) throw new Error(`Admin createUser error: ${error.message}`);
  return data.user;
}

/** Sign in a test user and inject their session into the browser via localStorage. */
export async function signInAndInject(page: Page, email: string, password = "TestPass123!") {
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword error: ${error.message}`);
  if (!data.session) throw new Error("No session returned");

  return injectSession(page, data.session);
}

/** Create user via admin API + inject session — accepts a pre-generated email. */
export async function signUpAndInject(page: Page, email: string, password = "TestPass123!") {
  await createTestUser(email, password);
  return signInAndInject(page, email, password);
}

/** Create + sign in + inject — one call to get a fresh auth'd browser. */
export async function createAndLogin(page: Page, label: string) {
  const email = uniqueEmail(label);
  await createTestUser(email);
  await signInAndInject(page, email);
  // Navigate to app — session is now in localStorage
  await page.goto("http://localhost:4000/dashboard");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  return { email };
}

async function injectSession(
  page: Page,
  session: { access_token: string; refresh_token: string; user: { id: string } }
) {
  // Need to be on the app origin to write localStorage
  await page.goto("http://localhost:4000/login");
  await page.waitForLoadState("domcontentloaded");

  const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    {
      key: storageKey,
      value: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: session.user,
      },
    }
  );

  return session;
}
