import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

/** Credit amounts per plan when a subscription is purchased or renews. */
const PLAN_CREDITS: Record<string, number> = {
  starter: 30,
  growth: 100,
  scale: 250,
};

/** Credit amounts per one-time pack purchase (matches CREDIT_PACKS + SINGLE_VIDEO_PACKS in lib/stripe.ts). */
const PACK_CREDITS: Record<string, number> = {
  pack_10: 10,          // $12
  pack_30: 30,          // $33
  pack_100: 100,        // $95
  single_standard: 5,   // $5  -- single standard video (Kling 2.6)
  single_hd: 10,        // $10 -- single HD video (Kling 3.0)
};

/** NOTE: No auth middleware -- this endpoint uses Stripe webhook signature verification. */
Deno.serve(async (req: Request) => {
  // No CORS needed for webhooks -- Stripe calls this server-to-server
  const headers: HeadersInit = { "Content-Type": "application/json" };

  if (req.method !== "POST") {
    return json({ detail: "Method not allowed" }, headers, 405);
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return json({ detail: "Missing stripe-signature header" }, headers, 400);
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Webhook signature verification failed:", msg);
      return json({ detail: "Invalid signature" }, headers, 400);
    }

    const sb = getAdminClient();

    // Idempotency check: skip if this event was already processed
    const { data: existingLog } = await sb
      .from("audit_logs")
      .select("id")
      .eq("event_id", event.id)
      .maybeSingle();

    if (existingLog) {
      return json({ data: { received: true, duplicate: true } }, headers);
    }

    // Track whether any critical DB operation failed so we can return 500
    // and let Stripe retry the event
    let processingError: string | null = null;

    // Process event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;

        if (!userId) {
          console.error("checkout.session.completed missing supabase_user_id:", session.id);
          break;
        }

        // -- One-time credit pack purchase --
        if (session.mode === "payment") {
          const pack = session.metadata?.pack;
          if (!pack) {
            console.error("checkout: payment session missing pack metadata:", session.id);
            break;
          }

          const credits = PACK_CREDITS[pack] ?? 0;
          if (credits > 0) {
            const { data: existing } = await sb
              .from("credit_balances")
              .select("remaining")
              .eq("owner_id", userId)
              .maybeSingle();

            const newBalance = (existing?.remaining ?? 0) + credits;

            const { error: balErr } = await sb.from("credit_balances").upsert(
              { owner_id: userId, remaining: newBalance },
              { onConflict: "owner_id" },
            );
            if (balErr) {
              console.error("checkout: pack credit upsert failed:", balErr);
              processingError = balErr.message;
            }

            const { error: ledgerErr } = await sb.from("credit_ledger").insert({
              owner_id: userId,
              amount: credits,
              reason: "credit_pack_purchase",
            });
            if (ledgerErr) {
              console.error("checkout: pack ledger insert failed:", ledgerErr);
              processingError = ledgerErr.message;
            }
          }
          break;
        }

        // -- Subscription checkout --
        const plan = session.metadata?.plan;
        if (!plan) {
          console.error("checkout.session.completed missing plan metadata:", session.id);
          break;
        }

        const stripeCustomerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        // Upsert subscription
        const { error: subErr } = await sb.from("subscriptions").upsert(
          {
            owner_id: userId,
            stripe_customer_id: stripeCustomerId ?? "",
            stripe_subscription_id: stripeSubscriptionId ?? null,
            plan,
            status: "active",
            current_period_start: new Date().toISOString(),
          },
          { onConflict: "owner_id" },
        );
        if (subErr) {
          console.error("checkout: subscription upsert failed:", subErr);
          processingError = subErr.message;
        }

        // Update profile plan
        const { error: profileErr } = await sb
          .from("profiles")
          .update({ plan })
          .eq("id", userId);
        if (profileErr) {
          console.error("checkout: profile update failed:", profileErr);
          processingError = profileErr.message;
        }

        // Grant initial credits for the plan (ADD to existing, don't overwrite)
        const credits = PLAN_CREDITS[plan] ?? 0;
        if (credits > 0) {
          const { data: existing } = await sb
            .from("credit_balances")
            .select("remaining")
            .eq("owner_id", userId)
            .maybeSingle();

          const newBalance = (existing?.remaining ?? 0) + credits;

          const { error: balErr } = await sb.from("credit_balances").upsert(
            { owner_id: userId, remaining: newBalance },
            { onConflict: "owner_id" },
          );
          if (balErr) {
            console.error("checkout: credit balance upsert failed:", balErr);
            processingError = balErr.message;
          }

          const { error: ledgerErr } = await sb.from("credit_ledger").insert({
            owner_id: userId,
            amount: credits,
            reason: "subscription_purchase",
          });
          if (ledgerErr) {
            console.error("checkout: credit ledger insert failed:", ledgerErr);
            processingError = ledgerErr.message;
          }
        }

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only process renewal invoices (not the first one which is handled by checkout)
        if (invoice.billing_reason !== "subscription_cycle") break;

        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!subscriptionId) break;

        // Look up the subscription in our DB
        const { data: sub } = await sb
          .from("subscriptions")
          .select("owner_id, plan")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (!sub) {
          console.error("invoice.paid: subscription not found:", subscriptionId);
          break;
        }

        // Grant renewal credits (reset to plan amount)
        const credits = PLAN_CREDITS[sub.plan] ?? 0;
        if (credits > 0) {
          const { error: balErr } = await sb.from("credit_balances").upsert(
            { owner_id: sub.owner_id, remaining: credits },
            { onConflict: "owner_id" },
          );
          if (balErr) {
            console.error("invoice.paid: credit balance upsert failed:", balErr);
            processingError = balErr.message;
          }

          const { error: ledgerErr } = await sb.from("credit_ledger").insert({
            owner_id: sub.owner_id,
            amount: credits,
            reason: "subscription_renewal",
          });
          if (ledgerErr) {
            console.error("invoice.paid: credit ledger insert failed:", ledgerErr);
            processingError = ledgerErr.message;
          }
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        // Reverse-lookup plan from price ID
        const planItem = subscription.items?.data?.[0];
        const priceId = planItem?.price?.id;

        // Try price ID lookup first (most reliable), then metadata fallback
        // Annual price IDs are hardcoded as fallbacks since env vars may not be available
        let plan: string | null = null;
        if (priceId) {
          const priceStarter        = Deno.env.get("STRIPE_PRICE_STARTER");
          const priceGrowth         = Deno.env.get("STRIPE_PRICE_GROWTH");
          const priceScale          = Deno.env.get("STRIPE_PRICE_SCALE");
          const priceStarterAnnual  = Deno.env.get("STRIPE_PRICE_STARTER_ANNUAL") ?? "price_1T661MDofGNcXNHKPIpj3KOE";
          const priceGrowthAnnual   = Deno.env.get("STRIPE_PRICE_GROWTH_ANNUAL")  ?? "price_1T662PDofGNcXNHKinIVq4Ft";
          const priceScaleAnnual    = Deno.env.get("STRIPE_PRICE_SCALE_ANNUAL")   ?? "price_1T663BDofGNcXNHKAymouo25";
          if (priceId === priceStarter || priceId === priceStarterAnnual) plan = "starter";
          else if (priceId === priceGrowth || priceId === priceGrowthAnnual) plan = "growth";
          else if (priceId === priceScale || priceId === priceScaleAnnual) plan = "scale";
        }
        // Fallback to metadata
        if (!plan) {
          plan = subscription.metadata?.plan ?? null;
        }

        // If we can't determine the plan, skip to avoid corrupting DB
        if (!plan) {
          console.error("subscription.updated: unknown plan for price ID", priceId);
          break;
        }

        const status = subscription.status === "active"
          ? "active"
          : subscription.status === "past_due"
          ? "past_due"
          : subscription.status === "canceled"
          ? "canceled"
          : "incomplete";

        const { error: updateErr } = await sb
          .from("subscriptions")
          .update({
            plan,
            status,
            current_period_start: new Date(
              subscription.current_period_start * 1000,
            ).toISOString(),
            current_period_end: new Date(
              subscription.current_period_end * 1000,
            ).toISOString(),
          })
          .eq("stripe_subscription_id", stripeSubId);

        if (updateErr) {
          console.error("subscription.updated: subscription update failed:", updateErr);
          processingError = updateErr.message;
        }

        // Update profile plan if subscription is still active
        if (plan && status === "active") {
          const { data: sub } = await sb
            .from("subscriptions")
            .select("owner_id")
            .eq("stripe_subscription_id", stripeSubId)
            .single();

          if (sub) {
            const { error: profileErr } = await sb
              .from("profiles")
              .update({ plan })
              .eq("id", sub.owner_id);

            if (profileErr) {
              console.error("subscription.updated: profile update failed:", profileErr);
              processingError = profileErr.message;
            }
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        // Mark subscription as canceled
        const { error: cancelErr } = await sb
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", stripeSubId);

        if (cancelErr) {
          console.error("subscription.deleted: subscription cancel failed:", cancelErr);
          processingError = cancelErr.message;
        }

        // Downgrade profile to free
        const { data: sub } = await sb
          .from("subscriptions")
          .select("owner_id")
          .eq("stripe_subscription_id", stripeSubId)
          .single();

        if (sub) {
          const { error: profileErr } = await sb
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", sub.owner_id);

          if (profileErr) {
            console.error("subscription.deleted: profile downgrade failed:", profileErr);
            processingError = profileErr.message;
          }

          // Clear remaining credits
          const { error: balErr } = await sb.from("credit_balances").upsert(
            { owner_id: sub.owner_id, remaining: 0 },
            { onConflict: "owner_id" },
          );

          if (balErr) {
            console.error("subscription.deleted: credit balance clear failed:", balErr);
            processingError = balErr.message;
          }
        }

        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (!paymentIntentId) {
          console.error("charge.refunded: no payment_intent on charge:", charge.id);
          break;
        }

        // Find the checkout session that created this payment to get metadata
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: paymentIntentId,
          limit: 1,
        });

        const session = sessions.data[0];
        if (!session) {
          console.error("charge.refunded: no checkout session for payment_intent:", paymentIntentId);
          break;
        }

        const userId = session.metadata?.supabase_user_id;
        if (!userId) {
          console.error("charge.refunded: no supabase_user_id in session metadata:", session.id);
          break;
        }

        // Determine credits to reverse from original purchase
        let creditsToDeduct = 0;
        const pack = session.metadata?.pack;
        const plan = session.metadata?.plan;

        if (pack && PACK_CREDITS[pack]) {
          creditsToDeduct = PACK_CREDITS[pack];
        } else if (plan && PLAN_CREDITS[plan]) {
          creditsToDeduct = PLAN_CREDITS[plan];
        } else {
          console.error("charge.refunded: could not determine credits for session:", session.id);
          break;
        }

        // For partial refunds, prorate credits proportionally
        if (charge.amount > 0 && charge.amount_refunded < charge.amount) {
          creditsToDeduct = Math.round(
            creditsToDeduct * (charge.amount_refunded / charge.amount),
          );
        }

        // Deduct credits (floor at 0)
        const { data: existing } = await sb
          .from("credit_balances")
          .select("remaining")
          .eq("owner_id", userId)
          .maybeSingle();

        const currentBalance = existing?.remaining ?? 0;
        const newBalance = Math.max(0, currentBalance - creditsToDeduct);

        const { error: balErr } = await sb.from("credit_balances").upsert(
          { owner_id: userId, remaining: newBalance },
          { onConflict: "owner_id" },
        );
        if (balErr) {
          console.error("charge.refunded: credit balance deduction failed:", balErr);
          processingError = balErr.message;
        }

        const { error: ledgerErr } = await sb.from("credit_ledger").insert({
          owner_id: userId,
          amount: -creditsToDeduct,
          reason: "refund",
        });
        if (ledgerErr) {
          console.error("charge.refunded: credit ledger insert failed:", ledgerErr);
          processingError = ledgerErr.message;
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;

        if (!subscriptionId) {
          console.log("invoice.payment_failed: no subscription_id, skipping");
          break;
        }

        const { data: sub } = await sb
          .from("subscriptions")
          .select("owner_id")
          .eq("stripe_subscription_id", subscriptionId)
          .single();

        if (sub) {
          console.warn(
            `invoice.payment_failed: subscription ${subscriptionId} for user ${sub.owner_id}`,
          );
        } else {
          console.warn(
            `invoice.payment_failed: subscription ${subscriptionId} not found in DB`,
          );
        }

        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // If a critical DB operation failed, return 500 so Stripe retries the event.
    // Don't insert audit_log so the idempotency guard won't block the retry.
    if (processingError) {
      console.error(
        `stripe-webhook: returning 500 for ${event.type} due to DB error:`,
        processingError,
      );
      return json({ detail: "Processing failed, will retry" }, headers, 500);
    }

    // Log the event for idempotency (only on success)
    await sb.from("audit_logs").insert({
      action: `stripe.${event.type}`,
      event_id: event.id,
      metadata: { type: event.type, livemode: event.livemode },
    });

    return json({ data: { received: true } }, headers);
  } catch (e: unknown) {
    console.error("stripe-webhook error:", e);
    return json({ detail: "Webhook processing failed" }, headers, 500);
  }
});
