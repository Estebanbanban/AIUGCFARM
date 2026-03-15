/**
 * Clerk JWT verification for Supabase Edge Functions.
 * Verifies the Clerk JWT from the Authorization header, then returns the
 * Supabase profile UUID (not the Clerk user ID) so that all edge functions
 * continue to work unchanged.
 */
import { getAdminClient } from "./supabase.ts";

interface JWKSKey {
  kty: string;
  use: string;
  kid: string;
  n: string;
  e: string;
}

// Cache keyed by JWKS URL to support multiple Clerk instances
const jwksCache = new Map<string, { keys: JWKSKey[]; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getJWKS(url: string) {
  const cached = jwksCache.get(url);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Clerk JWKS from ${url}: ${res.status}`);
  const data = await res.json() as { keys: JWKSKey[] };
  jwksCache.set(url, { ...data, fetchedAt: now });
  return data;
}

function base64urlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function verifyClerkJWT(token: string): Promise<string> {
  // Decode header to get kid
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const header = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

  // Check expiry
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error("JWT expired");

  // JWKS URL: prefer env var, fall back to JWT issuer ONLY if it matches a known Clerk domain.
  // This prevents an attacker from crafting a JWT with a malicious iss pointing to their own JWKS.
  const CLERK_DOMAIN_RE = /^https:\/\/[a-z0-9-]+\.clerk\.(accounts\.dev|com)$/;
  let jwksUrl = Deno.env.get("CLERK_JWKS_URL");
  if (!jwksUrl && payload.iss && CLERK_DOMAIN_RE.test(payload.iss)) {
    jwksUrl = `${payload.iss}/.well-known/jwks.json`;
  }
  if (!jwksUrl) throw new Error("Cannot determine JWKS URL — set CLERK_JWKS_URL or use a valid Clerk issuer");

  const jwks = await getJWKS(jwksUrl);
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("No matching JWK found");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk as unknown as JsonWebKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64urlToBytes(parts[2]);
  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, data);
  if (!valid) throw new Error("Invalid JWT signature");

  // sub is the Clerk user ID (e.g. "user_xxx")
  const clerkUserId: string = payload.sub;
  if (!clerkUserId) throw new Error("No sub in JWT");
  return clerkUserId;
}

/**
 * Extract and verify the authenticated user from the Authorization header.
 * Returns the Supabase profile UUID (for backward compatibility with all edge functions).
 */
export async function requireUserId(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) throw new Error("Unauthorized");

  const token = authHeader.slice(7).trim();
  if (!token) throw new Error("Unauthorized");

  let clerkUserId: string;
  try {
    clerkUserId = await verifyClerkJWT(token);
  } catch (e) {
    console.error("Clerk JWT verification failed:", e);
    throw new Error("Unauthorized");
  }

  // Look up the profile UUID by Clerk user ID
  const adminClient = getAdminClient();
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (!error && profile) return profile.id;

  // Profile not found by clerk_user_id — attempt lazy backfill.
  // This handles existing users whose profiles pre-date the Clerk migration
  // (their clerk_user_id column is null but their profile exists by email).
  console.warn("[auth] Profile not found by clerk_user_id:", clerkUserId, "— attempting lazy backfill");
  const clerkSecretKey = Deno.env.get("CLERK_SECRET_KEY");
  if (!clerkSecretKey) {
    console.error("[auth] CLERK_SECRET_KEY not set in Supabase secrets — backfill impossible for clerk_user_id:", clerkUserId);
  } else {
    try {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      });
      if (clerkRes.ok) {
        const clerkUser = await clerkRes.json() as { email_addresses?: Array<{ email_address: string }> };
        const email = clerkUser.email_addresses?.[0]?.email_address;
        if (email) {
          // Find existing profile by email — only link if clerk_user_id is NULL
          // to prevent account takeover via email registration on Clerk.
          const { data: existingProfile } = await adminClient
            .from("profiles")
            .select("id, clerk_user_id")
            .eq("email", email)
            .maybeSingle();

          if (existingProfile) {
            if (existingProfile.clerk_user_id && existingProfile.clerk_user_id !== clerkUserId) {
              // Profile already linked to a different Clerk user — refuse to overwrite
              console.error("[auth] Profile", existingProfile.id, "already linked to", existingProfile.clerk_user_id, "— refusing to re-link to", clerkUserId);
              throw new Error("Unauthorized");
            }
            if (!existingProfile.clerk_user_id) {
              // Link the clerk_user_id for the first time
              await adminClient
                .from("profiles")
                .update({ clerk_user_id: clerkUserId })
                .eq("id", existingProfile.id)
                .is("clerk_user_id", null); // double-guard against race condition
              console.log("[auth] Linked clerk_user_id for profile:", existingProfile.id);
            }
            return existingProfile.id;
          }

          // No profile by email — create a minimal one so the user can proceed
          console.warn("[auth] No profile by email, creating new for Clerk user:", clerkUserId);
          const { data: newProfile, error: insertErr } = await adminClient
            .from("profiles")
            .insert({ clerk_user_id: clerkUserId, email, plan: "free" })
            .select("id")
            .single();
          if (!insertErr && newProfile) {
            console.log("[auth] Created new profile:", newProfile.id);
            return newProfile.id;
          }
          console.error("[auth] Failed to create profile:", insertErr);
        }
      }
    } catch (backfillErr) {
      console.error("[auth] Lazy backfill failed:", backfillErr);
    }
  }

  console.error("[auth] Profile not found for Clerk user:", clerkUserId, error);
  throw new Error("Unauthorized");
}

export async function optionalUserId(req: Request): Promise<string | null> {
  try {
    return await requireUserId(req);
  } catch {
    return null;
  }
}
