import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPersonaSchema } from "@/schemas/persona";
import { PLANS } from "@/lib/stripe";
import { success, error } from "@/types/api";
import type { PlanTier } from "@/lib/stripe";

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    const { data: personas, error: dbError } = await supabase
      .from("personas")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("[personas/GET] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to fetch personas"), { status: 500 });
    }

    return NextResponse.json(success(personas));
  } catch (err) {
    console.error("[personas/GET] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const parsed = createPersonaSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        error("VALIDATION_ERROR", firstError?.message ?? "Invalid input", firstError?.path.join(".")),
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    // Check persona slot limit based on subscription tier
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("tier")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .single();

    if (!subscription) {
      return NextResponse.json(
        error("NO_SUBSCRIPTION", "An active subscription is required to create personas"),
        { status: 403 }
      );
    }

    const tier = subscription.tier as PlanTier;
    const plan = PLANS[tier];
    if (!plan) {
      return NextResponse.json(error("INVALID_PLAN", "Invalid subscription tier"), { status: 500 });
    }

    // Count existing active personas
    const { count: personaCount } = await supabase
      .from("personas")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("deleted_at", null);

    if ((personaCount ?? 0) >= plan.personaSlots) {
      return NextResponse.json(
        error(
          "PERSONA_LIMIT_REACHED",
          `Your ${plan.name} plan allows up to ${plan.personaSlots} persona(s). Please upgrade or delete an existing persona.`
        ),
        { status: 403 }
      );
    }

    const { data: persona, error: dbError } = await supabase
      .from("personas")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (dbError) {
      console.error("[personas/POST] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to create persona"), { status: 500 });
    }

    return NextResponse.json(success(persona), { status: 201 });
  } catch (err) {
    console.error("[personas/POST] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
