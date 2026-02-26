export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { success, error } from "@/types/api";

export async function POST() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user?.stripe_customer_id) {
      return NextResponse.json(error("NO_SUBSCRIPTION", "No billing account found. Please subscribe first."), {
        status: 400,
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    });

    return NextResponse.json(success({ url: session.url }));
  } catch (err) {
    console.error("[billing/portal] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to create billing portal session"), { status: 500 });
  }
}
