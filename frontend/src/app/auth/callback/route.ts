import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | "magiclink" | "signup" | null;
  const next = searchParams.get("next") ?? "/dashboard";

  // Supabase forwards provider errors (e.g. consent denied, email not verified)
  // as ?error=...&error_description=... - handle before trying any exchange.
  const providerError = searchParams.get("error");
  if (providerError) {
    const desc = searchParams.get("error_description") ?? providerError;
    console.error("OAuth provider error:", providerError, desc);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(desc)}`
    );
  }

  const supabase = await createClient();

  // PKCE flow (code exchange)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // PKCE code exchange failed (code_verifier missing, e.g. link opened in
    // a different browser than where signup was initiated). Fall through so
    // the user can still sign in manually.
    console.error("PKCE code exchange failed:", error?.message);

    // For OAuth providers the user can just re-authenticate - send them to
    // login with a clear message rather than a cryptic error code.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message ?? "Sign-in failed. Please try again.")}`
    );
  }

  // OTP / token hash flow (email confirmation, magic link, recovery)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("OTP verify failed:", error?.message);
    // Return an actual error - do NOT fall through to the signup success message below.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message ?? "Email confirmation failed. Please try again.")}`
    );
  }

  // If this was a signup confirmation link opened in a different browser (no tokenHash),
  // redirect to login with a helpful message.
  if (type === "signup" || searchParams.get("type") === "signup") {
    return NextResponse.redirect(
      `${origin}/login?message=Email+confirmed.+Please+sign+in.`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
