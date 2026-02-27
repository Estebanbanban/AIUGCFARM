import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "recovery" | "magiclink" | null;
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createClient();

  // PKCE flow (code exchange)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // PKCE code exchange failed (code_verifier missing — e.g. link opened in
    // a different browser than where signup was initiated). Fall through so
    // the user can still sign in manually.
    console.error("PKCE code exchange failed:", error?.message);
  }

  // OTP / token hash flow (email confirmation, magic link, recovery)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("OTP verify failed:", error?.message);
  }

  // If this was a signup confirmation that failed PKCE (cross-browser link open),
  // redirect to login with a helpful message rather than a generic error.
  if (type === "signup" || searchParams.get("type") === "signup") {
    return NextResponse.redirect(
      `${origin}/login?message=Email+confirmed.+Please+sign+in.`
    );
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
