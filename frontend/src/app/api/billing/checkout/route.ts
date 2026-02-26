export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, PLANS } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkoutSchema } from "@/schemas/billing";
import { success, error } from "@/types/api";

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        error("VALIDATION_ERROR", firstError?.message ?? "Invalid input", firstError?.path.join(".")),
        { status: 400 }
      );
    }

    const { priceId } = parsed.data;

    // Verify the price ID belongs to a known plan
    const matchingPlan = Object.values(PLANS).find((plan) => plan.priceId === priceId);
    if (!matchingPlan) {
      return NextResponse.json(error("INVALID_PLAN", "Unknown price ID"), { status: 400 });
    }

    const supabase = createAdminClient();

    // Look up internal user
    const { data: user } = await supabase
      .from("users")
      .select("id, email, stripe_customer_id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { clerkUserId, internalUserId: user.id },
      });
      customerId = customer.id;

      await supabase.from("users").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=canceled`,
      metadata: { clerkUserId },
      subscription_data: {
        metadata: { clerkUserId },
      },
    });

    return NextResponse.json(success({ url: session.url }));
  } catch (err) {
    console.error("[billing/checkout] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create checkout session"), { status: 500 });
  }
}
