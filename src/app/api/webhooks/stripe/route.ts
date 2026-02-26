import { NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlanTier } from "@/lib/stripe";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkUserId = session.metadata?.clerkUserId;

      if (!clerkUserId || session.mode !== "subscription") {
        break;
      }

      // Find or create internal user
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", clerkUserId)
        .single();

      if (!user) {
        console.error(`[stripe-webhook] User not found for clerk_id: ${clerkUserId}`);
        break;
      }

      // Update user's stripe_customer_id
      await supabase
        .from("users")
        .update({ stripe_customer_id: session.customer as string })
        .eq("id", user.id);

      // Retrieve the subscription to get details
      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id;

      // Determine tier from price ID
      const tier = determineTier(priceId);
      if (!tier) {
        console.error(`[stripe-webhook] Unknown price ID: ${priceId}`);
        break;
      }

      const plan = PLANS[tier];

      // Create or update subscription record
      await supabase.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          tier,
          status: subscription.status as string,
          segment_credits_total: plan.segmentCredits,
          segment_credits_used: 0,
          current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
          current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
          cancel_at_period_end: (subscription as any).cancel_at_period_end ?? false,
        },
        { onConflict: "user_id" }
      );

      // Create initial credit grant transaction
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        subscription_id: subscription.id,
        type: "subscription_grant",
        amount: plan.segmentCredits,
        balance_after: plan.segmentCredits,
        description: `Initial ${plan.name} plan grant — ${plan.segmentCredits} segment credits`,
      });

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;

      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id, user_id")
        .eq("stripe_subscription_id", subscription.id)
        .single();

      if (!existingSub) {
        console.error(`[stripe-webhook] Subscription not found: ${subscription.id}`);
        break;
      }

      const priceId = subscription.items.data[0]?.price.id;
      const tier = determineTier(priceId);

      const sub = subscription as any;
      const updateData: Record<string, unknown> = {
        status: subscription.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
      };

      // If tier changed (plan upgrade/downgrade), update tier and credits
      if (tier) {
        updateData.tier = tier;
        updateData.stripe_price_id = priceId;
        updateData.segment_credits_total = PLANS[tier].segmentCredits;
      }

      await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("id", existingSub.id);

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("stripe_subscription_id", subscription.id);

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as any;

      // Only handle subscription renewals (not the first payment)
      if (!invoice.subscription || invoice.billing_reason !== "subscription_cycle") {
        break;
      }

      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id, user_id, tier, segment_credits_total")
        .eq("stripe_subscription_id", invoice.subscription as string)
        .single();

      if (!existingSub) {
        break;
      }

      const tier = existingSub.tier as PlanTier;
      const credits = PLANS[tier]?.segmentCredits ?? existingSub.segment_credits_total;

      // Reset credits for the new billing period
      await supabase
        .from("subscriptions")
        .update({
          segment_credits_used: 0,
          segment_credits_total: credits,
        })
        .eq("id", existingSub.id);

      // Create credit grant transaction for the new period
      await supabase.from("credit_transactions").insert({
        user_id: existingSub.user_id,
        subscription_id: existingSub.id,
        type: "subscription_grant",
        amount: credits,
        balance_after: credits,
        description: `Monthly ${PLANS[tier]?.name ?? tier} plan renewal — ${credits} segment credits`,
      });

      break;
    }
  }

  return NextResponse.json({ received: true });
}

function determineTier(priceId: string | undefined): PlanTier | null {
  if (!priceId) return null;
  for (const [tier, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) {
      return tier as PlanTier;
    }
  }
  return null;
}
