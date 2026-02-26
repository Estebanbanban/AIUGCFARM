import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest";
import { createComboSchema } from "@/schemas/generation";
import { success, error } from "@/types/api";

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const parsed = createComboSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        error("VALIDATION_ERROR", firstError?.message ?? "Invalid input", firstError?.path.join(".")),
        { status: 400 }
      );
    }

    const { hook_segment_id, body_segment_id, cta_segment_id } = parsed.data;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    // Verify all three segments exist, belong to user, and are completed
    const segmentIds = [hook_segment_id, body_segment_id, cta_segment_id];
    const { data: segments, error: segError } = await supabase
      .from("segments")
      .select("id, type, status, user_id")
      .in("id", segmentIds)
      .eq("user_id", user.id);

    if (segError) {
      console.error("[combos/POST] Segment lookup error:", segError);
      return NextResponse.json(error("DB_ERROR", "Failed to verify segments"), { status: 500 });
    }

    if (!segments || segments.length !== 3) {
      return NextResponse.json(
        error("NOT_FOUND", "One or more segments not found or do not belong to you"),
        { status: 404 }
      );
    }

    // Verify segment types match expected types
    const segmentMap = new Map(segments.map((s) => [s.id, s]));
    const hookSeg = segmentMap.get(hook_segment_id);
    const bodySeg = segmentMap.get(body_segment_id);
    const ctaSeg = segmentMap.get(cta_segment_id);

    if (hookSeg?.type !== "hook" || bodySeg?.type !== "body" || ctaSeg?.type !== "cta") {
      return NextResponse.json(
        error("INVALID_SEGMENTS", "Segments must match their expected types: hook, body, cta"),
        { status: 400 }
      );
    }

    // Check that all segments are completed
    const allCompleted = segments.every((s) => s.status === "completed");
    if (!allCompleted) {
      return NextResponse.json(
        error("SEGMENTS_NOT_READY", "All segments must be in 'completed' status before creating a combo"),
        { status: 400 }
      );
    }

    // Create combo record
    const { data: combo, error: comboError } = await supabase
      .from("video_combos")
      .insert({
        user_id: user.id,
        hook_segment_id,
        body_segment_id,
        cta_segment_id,
        status: "pending",
      })
      .select()
      .single();

    if (comboError || !combo) {
      console.error("[combos/POST] Combo creation error:", comboError);
      return NextResponse.json(error("DB_ERROR", "Failed to create combo"), { status: 500 });
    }

    // Send Inngest event for async video assembly
    await inngest.send({
      name: "app/combo.assemble",
      data: {
        comboId: combo.id,
        userId: user.id,
        hookSegmentId: hook_segment_id,
        bodySegmentId: body_segment_id,
        ctaSegmentId: cta_segment_id,
      },
    });

    return NextResponse.json(success(combo), { status: 201 });
  } catch (err) {
    console.error("[combos/POST] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
