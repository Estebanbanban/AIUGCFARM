import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const BASE = 'http://localhost:4000';
const SUPABASE_URL = 'https://nuodqvvgfwptnnlvmqbe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2RxdnZnZndwdG5ubHZtcWJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNzc1MjksImV4cCI6MjA4Nzc1MzUyOX0.kA_8qrjDvasEtzPgI5jMTHS4HhkrbGM0TUBhiX_3sCQ';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51b2RxdnZnZndwdG5ubHZtcWJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE3NzUyOSwiZXhwIjoyMDg3NzUzNTI5fQ.la7L5epIEuMQeLvig6KBWLrV7YV684gyUUNG5xQzJyQ';

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const id = Date.now();
const email = `aiugc.audit.${id}@mailinator.com`;
const password = 'TestPass123!';

let userId = null;
let productId = null;
let personaId = null;
let browser = null;

function log(msg, data) {
  if (data === undefined) {
    console.log(msg);
  } else {
    console.log(msg, data);
  }
}

async function cleanup() {
  try {
    if (productId) await admin.from('products').delete().eq('id', productId);
    if (personaId) await admin.from('personas').delete().eq('id', personaId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  } catch (e) {
    console.log('cleanup warning:', e?.message || e);
  }
  if (browser) await browser.close();
}

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user?.id;
  if (!userId) throw new Error('Missing user id');

  const prod = await admin
    .from('products')
    .insert({
      owner_id: userId,
      store_url: null,
      name: `Audit Product ${id}`,
      description: 'Audit product description',
      price: 29.99,
      currency: 'USD',
      category: 'beauty',
      images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9'],
      brand_summary: {
        tone: 'friendly',
        demographic: 'general',
        selling_points: ['fast', 'affordable'],
      },
      source: 'manual',
      confirmed: true,
    })
    .select('id')
    .single();
  if (prod.error) throw prod.error;
  productId = prod.data.id;

  const persona = await admin
    .from('personas')
    .insert({
      owner_id: userId,
      name: `Audit Persona ${id}`,
      attributes: {
        gender: 'female',
        skin_tone: 'light',
        age: '25-34',
        hair_color: 'brown',
        hair_style: 'wavy',
        eye_color: 'brown',
        body_type: 'average',
        clothing_style: 'casual',
        accessories: [],
      },
      selected_image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
      generated_images: ['https://images.unsplash.com/photo-1494790108377-be9c29b29330'],
      is_active: true,
    })
    .select('id')
    .single();
  if (persona.error) throw persona.error;
  personaId = persona.data.id;

  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  if (!signedIn.data.session) throw new Error('No session returned');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    {
      key: storageKey,
      value: {
        access_token: signedIn.data.session.access_token,
        refresh_token: signedIn.data.session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: signedIn.data.session.user,
      },
    },
  );

  await page.goto(`${BASE}/generate`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const section1Visible = await page.getByText('Product & Format').first().isVisible();
  log('section1 visible:', section1Visible);

  await page.getByText(`Audit Product ${id}`).first().click();
  await page.getByRole('button', { name: 'Portrait' }).first().click();
  await page.getByRole('button', { name: /^Continue$/ }).click();

  await page.waitForTimeout(600);
  const section2Visible = await page.getByText('AI Spokesperson').first().isVisible();
  log('section2 visible after continue:', section2Visible);

  await page.getByText(`Audit Persona ${id}`).first().click();
  await page.waitForTimeout(1500);

  const section3Visible = await page.getByText('Settings & Generate').first().isVisible();
  log('section3 visible after persona select:', section3Visible);

  const generatePreviewVisible = await page.getByRole('button', { name: /Generate Scene Preview/i }).isVisible().catch(() => false);
  const generatingPreviewMsgVisible = await page.getByText(/Placing your persona|Compositing product/i).isVisible().catch(() => false);
  log('preview CTA visible (or pending):', generatePreviewVisible || generatingPreviewMsgVisible);

  const changeButtons = page.getByRole('button', { name: 'Change' });
  const count = await changeButtons.count();
  if (count >= 2) {
    await changeButtons.nth(1).click();
    await page.waitForTimeout(500);
    const section2BodyVisible = await page.getByText(`Audit Persona ${id}`).first().isVisible();
    const section3StillVisible = await page.getByText('Settings & Generate').first().isVisible().catch(() => false);
    log('section2 reopened via Change:', section2BodyVisible);
    log('section3 hidden after reopening section2:', !section3StillVisible);
  } else {
    log('change button count:', count);
  }

  await page.screenshot({ path: '/tmp/aiugc-generate-audit.png', fullPage: true });
  log('screenshot:', '/tmp/aiugc-generate-audit.png');

  await context.close();
  await cleanup();
} catch (err) {
  console.error('AUDIT SCRIPT FAILED:', err?.message || err);
  await cleanup();
  process.exit(1);
}
