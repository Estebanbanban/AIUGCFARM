import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUserId } from "../_shared/auth.ts";
import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (req.method !== "POST") {
      return json({ detail: "Method not allowed" }, cors, 405);
    }

    const userId = await requireUserId(req);
    const sb = getAdminClient();

    // Optional confirmation check
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return json(
        { detail: 'Send { "confirm": true } to permanently delete your account.' },
        cors,
        400,
      );
    }

    // 1. Cancel Stripe subscription if exists
    const { data: subscription } = await sb
      .from("subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (stripeErr) {
        console.error("Stripe cancellation error:", stripeErr);
        // Continue with deletion even if Stripe cancellation fails
      }
    }

    // 2. Delete storage objects across all buckets in parallel
    const buckets = [
      "product-images",
      "persona-images",
      "composite-images",
      "generated-videos",
    ];

    await Promise.all(buckets.map(async (bucket) => {
      const { data: files } = await sb.storage.from(bucket).list(userId);

      if (files && files.length > 0) {
        // Separate files from folders
        const filePaths = files.filter((f) => f.id !== null).map((f) => `${userId}/${f.name}`);
        const folders = files.filter((f) => f.id === null);

        // Delete top-level files and clean up sub-folders in parallel
        const tasks: Promise<unknown>[] = [];

        if (filePaths.length > 0) {
          tasks.push(sb.storage.from(bucket).remove(filePaths));
        }

        for (const folder of folders) {
          tasks.push(
            (async () => {
              const { data: subFiles } = await sb.storage
                .from(bucket)
                .list(`${userId}/${folder.name}`);
              if (subFiles && subFiles.length > 0) {
                const subPaths = subFiles.map(
                  (f) => `${userId}/${folder.name}/${f.name}`,
                );
                await sb.storage.from(bucket).remove(subPaths);
              }
            })()
          );
        }

        await Promise.all(tasks);
      }
    }));

    // 3. Delete database records in parallel
    // credit_ledger depends on credit_balances via FK, so delete ledger first,
    // then the rest can go in parallel.
    await sb.from("credit_ledger").delete().eq("owner_id", userId);
    await Promise.all([
      sb.from("credit_balances").delete().eq("owner_id", userId),
      sb.from("generations").delete().eq("owner_id", userId),
      sb.from("personas").delete().eq("owner_id", userId),
      sb.from("products").delete().eq("owner_id", userId),
      sb.from("subscriptions").delete().eq("owner_id", userId),
      sb.from("audit_logs").delete().eq("owner_id", userId),
    ]);

    // 4. Fetch clerk_user_id before deleting profile
    const { data: profileRow } = await sb
      .from("profiles")
      .select("clerk_user_id")
      .eq("id", userId)
      .maybeSingle();

    // 5. Delete profile (should cascade from auth.users, but be explicit)
    await sb.from("profiles").delete().eq("id", userId);

    // 6. Delete the auth user (requires service role)
    const { error: authErr } = await sb.auth.admin.deleteUser(userId);
    if (authErr) {
      console.error("Auth user deletion failed:", authErr);
      // Data is already gone, log the error but return success
    }

    // 7. Delete the Clerk user (GDPR compliance)
    const clerkUserId = profileRow?.clerk_user_id;
    if (clerkUserId) {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${Deno.env.get("CLERK_SECRET_KEY")}`,
        },
      });
      if (!clerkRes.ok) {
        console.error("Failed to delete Clerk user:", await clerkRes.text());
        // Don't throw — Supabase data is already deleted, log and continue
      }
    }

    return json({ data: { deleted: true } }, cors);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Unauthorized") {
      return json({ detail: "Authentication required" }, cors, 401);
    }
    console.error("delete-account error:", e);
    return json({ detail: "Internal error" }, cors, 500);
  }
});
