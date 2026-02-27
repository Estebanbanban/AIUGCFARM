/**
 * Supabase Auth Hook — Send Email
 *
 * Configured in: Supabase Dashboard → Authentication → Hooks → Send Email Hook
 * URL: https://<project>.supabase.co/functions/v1/send-email
 *
 * Intercepts all Supabase Auth emails (signup confirmation, magic link,
 * password reset, email change) and delivers them via Resend instead of
 * Supabase's built-in SMTP (which is rate-limited to 3/hour).
 *
 * Supabase calls this with a POST containing:
 * {
 *   user: { email: string; ... },
 *   email_data: {
 *     token: string;
 *     token_hash: string;
 *     redirect_to: string;
 *     email_action_type: "signup" | "recovery" | "magiclink" | "email_change_new" | "email_change_current";
 *     site_url: string;
 *     verification_link?: string;
 *   }
 * }
 */

import { sendEmail } from "../_shared/email.ts";

const SITE_URL = Deno.env.get("FRONTEND_URL") || "https://www.cinerads.com";

interface AuthHookPayload {
  user: {
    email: string;
    new_email?: string;
  };
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

function confirmationEmail(confirmUrl: string): string {
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
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6">
            Click the button below to confirm your email address and activate your CineRads account.
          </p>
          <a href="${confirmUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">
            Confirm your email
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#9ca3af">
            Or copy this link: <a href="${confirmUrl}" style="color:#f97316;word-break:break-all">${confirmUrl}</a>
          </p>
          <p style="margin:20px 0 0;font-size:13px;color:#9ca3af">
            This link expires in 24 hours. If you didn't sign up, you can safely ignore this email.
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
            We received a request to reset your password. Click the button below to choose a new one.
          </p>
          <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:8px">
            Reset password
          </a>
          <p style="margin:28px 0 0;font-size:13px;color:#9ca3af">
            This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.
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
            Click the button below to sign in to CineRads. This link is single-use and expires in 1 hour.
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
  // Supabase Auth Hooks use POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = (await req.json()) as AuthHookPayload;
    const { user, email_data } = payload;
    const toEmail = user.email;
    const { email_action_type, token_hash, redirect_to } = email_data;

    // Build the confirmation/action URL that routes through our callback
    const actionUrl =
      email_data.verification_link ||
      `${SITE_URL}/auth/callback?token_hash=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to || SITE_URL + "/dashboard")}`;

    let subject: string;
    let html: string;

    switch (email_action_type) {
      case "signup":
        subject = "Confirm your CineRads account";
        html = confirmationEmail(actionUrl);
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
        html = confirmationEmail(actionUrl);
        break;

      default:
        console.warn("Unhandled email_action_type:", email_action_type);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
    }

    await sendEmail({ to: toEmail, subject, html });
    console.log(`Auth email sent: ${email_action_type} → ${toEmail}`);

    // Supabase Auth Hooks expect a 200 with empty or minimal JSON body
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-email hook error:", msg);
    // Return 500 so Supabase knows the email failed and can retry/log
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
