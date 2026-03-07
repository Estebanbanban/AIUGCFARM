/**
 * Supabase Auth Hook  -  Send Email
 *
 * Wired in: supabase/config.toml → [auth.hook.send_email]
 *
 * Intercepts all Supabase Auth emails and delivers them via Resend.
 * - signup      → 6-digit OTP code (user types it in the app)
 * - recovery    → password reset link
 * - magiclink   → magic link
 * - email_change → confirmation link
 */

import { sendEmail } from "../_shared/email.ts";

const SITE_URL = Deno.env.get("FRONTEND_URL") || "https://www.cinerads.com";
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

/**
 * Verify the Supabase Auth Hook HMAC-SHA256 signature.
 * Supabase sends: Authorization: <version>,<signature>
 * where <version> = "v1" and <signature> = hex(HMAC-SHA256(body, secret))
 * The secret in env is stored as "v1,whsec_<base64>"  -  we extract the base64 key part.
 */
async function verifyHookSignature(req: Request, body: string): Promise<boolean> {
  if (!HOOK_SECRET) {
    console.error("SEND_EMAIL_HOOK_SECRET is not set");
    return false;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("v1,")) return false;

  const signature = authHeader.slice(3);

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(HOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const sigBytes = new Uint8Array(signature.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    return await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(body));
  } catch (e) {
    console.error("verifyHookSignature error:", e);
    return false;
  }
}

interface AuthHookPayload {
  user: { email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "recovery"
      | "magiclink"
      | "email_change_new"
      | "email_change_current";
    site_url: string;
    verification_link?: string;
  };
}

function otpEmail(code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f3f4f6">
          <p style="margin:0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.5px">CineRads</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">Confirm your email</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6">
            Enter this code in the app to activate your CineRads account:
          </p>
          <div style="background:#f3f4f6;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:40px;font-weight:700;color:#111827;letter-spacing:10px">${code}</span>
          </div>
          <p style="margin:0;font-size:13px;color:#9ca3af">
            This code expires in 24 hours. If you didn't sign up, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 CineRads · AI UGC Video Generator</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function resetPasswordEmail(resetUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f3f4f6">
          <p style="margin:0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.5px">CineRads</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">Reset your password</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6">
            Click the button below to choose a new password.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">
            Reset password
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#9ca3af">
            This link expires in 1 hour. If you didn't request a reset, ignore this email.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 CineRads · AI UGC Video Generator</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function magicLinkEmail(magicUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #f3f4f6">
          <p style="margin:0;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.5px">CineRads</p>
        </td></tr>
        <tr><td style="padding:32px 40px">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">Your magic link</h1>
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6">
            Click below to sign in. Single-use, expires in 1 hour.
          </p>
          <a href="${magicUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">
            Sign in to CineRads
          </a>
        </td></tr>
        <tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #f3f4f6">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2026 CineRads · AI UGC Video Generator</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const rawBody = await req.text();

    if (!(await verifyHookSignature(req, rawBody))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody) as AuthHookPayload;
    const { user, email_data } = payload;
    const toEmail = user.email;
    const { email_action_type, token, token_hash, redirect_to } = email_data;

    const actionUrl =
      email_data.verification_link ||
      `${SITE_URL}/auth/callback?token_hash=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to || SITE_URL + "/dashboard")}`;

    let subject: string;
    let html: string;

    switch (email_action_type) {
      case "signup":
        subject = "Your CineRads verification code";
        html = otpEmail(token);
        break;

      case "recovery":
        subject = "Reset your CineRads password";
        html = resetPasswordEmail(actionUrl);
        break;

      case "magiclink":
        subject = "Your CineRads magic link";
        html = magicLinkEmail(actionUrl);
        break;

      case "email_change_new":
      case "email_change_current":
        subject = "Confirm your new email address";
        html = otpEmail(token);
        break;

      default:
        console.warn("Unhandled email_action_type:", email_action_type);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
    }

    await sendEmail({ to: toEmail, subject, html });
    console.log(`Auth email sent: ${email_action_type} → ${toEmail}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-email hook error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
