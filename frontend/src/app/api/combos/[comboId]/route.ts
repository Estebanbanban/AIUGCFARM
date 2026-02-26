import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { success, error } from "@/types/api";

type RouteParams = { params: Promise<{ comboId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { comboId } = await params;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    const { data: combo, error: dbError } = await supabase
      .from("video_combos")
      .select("*")
      .eq("id", comboId)
      .eq("user_id", user.id)
      .single();

    if (dbError || !combo) {
      return NextResponse.json(error("NOT_FOUND", "Combo not found"), { status: 404 });
    }

    return NextResponse.json(success(combo));
  } catch (err) {
    console.error("[combos/GET/:id] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
