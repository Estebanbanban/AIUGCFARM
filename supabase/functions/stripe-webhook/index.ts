import { json } from "../_shared/response.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
  httpClient: Stripe.createFetchHttpClient(),
});

/** Credit amounts per plan when a subscription renews. */
const PLAN_CREDITS: Record<string, number> = {
  starter: 27,
  growth: 90,
  scale: 300,
};

/** NOTE: No auth middleware — this endpoint uses Stripe webhook signature verification. */
Deno.serve(async (req: Request) => {
  // No CORS needed for webhooks — Stripe calls this server-to-server
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

    // Process event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const plan = session.metadata?.plan;

        if (!userId || !plan) {
          console.error("checkout.session.completed missing metadata:", session.id);
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
        if (subErr) console.error("checkout: subscription upsert failed:", subErr);

        // Update profile plan
        const { error: profileErr } = await sb
          .from("profiles")
          .update({ plan })
          .eq("id", userId);
        if (profileErr) console.error("checkout: profile update failed:", profileErr);

        // Grant initial credits for the plan
        const credits = PLAN_CREDITS[plan] ?? 0;
        if (credits > 0) {
          // Upsert credit balance
          const { error: balErr } = await sb.from("credit_balances").upsert(
            { owner_id: userId, remaining: credits },
            { onConflict: "owner_id" },
          );
          if (balErr) console.error("checkout: credit balance upsert failed:", balErr);

          const { error: ledgerErr } = await sb.from("credit_ledger").insert({
            owner_id: userId,
            amount: credits,
            reason: "subscription_renewal",
          });
          if (ledgerErr) console.error("checkout: credit ledger insert failed:", ledgerErr);
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

        // Grant renewal credits
        const credits = PLAN_CREDITS[sub.plan] ?? 0;
        if (credits > 0) {
          // Reset credit balance to plan amount on renewal
          const { error: balErr } = await sb.from("credit_balances").upsert(
            { owner_id: sub.owner_id, remaining: credits },
            { onConflict: "owner_id" },
          );
          if (balErr) console.error("invoice.paid: credit balance upsert failed:", balErr);

          const { error: ledgerErr } = await sb.from("credit_ledger").insert({
            owner_id: sub.owner_id,
            amount: credits,
            reason: "subscription_renewal",
          });
          if (ledgerErr) console.error("invoice.paid: credit ledger insert failed:", ledgerErr);
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
        let plan: string | null = null;
        if (priceId) {
          const priceStarter = Deno.env.get("STRIPE_PRICE_STARTER");
          const priceGrowth = Deno.env.get("STRIPE_PRICE_GROWTH");
          const priceScale = Deno.env.get("STRIPE_PRICE_SCALE");
          if (priceId === priceStarter) plan = "starter";
          else if (priceId === priceGrowth) plan = "growth";
          else if (priceId === priceScale) plan = "scale";
        }
        // Fallback to metadata
        if (!plan) {
          plan = subscription.metadata?.plan ?? null;
        }

        const status = subscription.status === "active"
          ? "active"
          : subscription.status === "past_due"
          ? "past_due"
          : subscription.status === "canceled"
          ? "canceled"
          : "incomplete";

        await sb
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

        // Update profile plan if subscription is still active
        if (plan && status === "active") {
          const { data: sub } = await sb
            .from("subscriptions")
            .select("owner_id")
            .eq("stripe_subscription_id", stripeSubId)
            .single();

          if (sub) {
            await sb
              .from("profiles")
              .update({ plan })
              .eq("id", sub.owner_id);
          }
        }

        void priceId; // available for future price-based plan lookup

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeSubId = subscription.id;

        // Mark subscription as canceled
        await sb
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", stripeSubId);

        // Downgrade profile to free
        const { data: sub } = await sb
          .from("subscriptions")
          .select("owner_id")
          .eq("stripe_subscription_id", stripeSubId)
          .single();

        if (sub) {
          await sb
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", sub.owner_id);
        }

        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // Log the event for idempotency
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
