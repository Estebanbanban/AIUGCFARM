import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest";
import { createSegmentBatchSchema } from "@/schemas/generation";
import { success, error } from "@/types/api";

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const parsed = createSegmentBatchSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        error("VALIDATION_ERROR", firstError?.message ?? "Invalid input", firstError?.path.join(".")),
        { status: 400 }
      );
    }

    const { product_id, persona_id, segments: segmentRequests } = parsed.data;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    // Verify product ownership
    const { data: product } = await supabase
      .from("products")
      .select("id")
      .eq("id", product_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!product) {
      return NextResponse.json(error("NOT_FOUND", "Product not found"), { status: 404 });
    }

    // Verify persona ownership
    const { data: persona } = await supabase
      .from("personas")
      .select("id")
      .eq("id", persona_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!persona) {
      return NextResponse.json(error("NOT_FOUND", "Persona not found"), { status: 404 });
    }

    // Calculate total segments needed
    const totalSegments = segmentRequests.reduce((sum, s) => sum + s.count, 0);

    // Check credit balance
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, segment_credits_total, segment_credits_used")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .single();

    if (!subscription) {
      return NextResponse.json(
        error("NO_SUBSCRIPTION", "An active subscription is required to generate segments"),
        { status: 403 }
      );
    }

    const availableCredits = subscription.segment_credits_total - subscription.segment_credits_used;
    if (availableCredits < totalSegments) {
      return NextResponse.json(
        error(
          "INSUFFICIENT_CREDITS",
          `Not enough segment credits. Available: ${availableCredits}, Required: ${totalSegments}. Please upgrade your plan.`
        ),
        { status: 403 }
      );
    }

    // Decrement credits atomically using RPC or direct update
    const newCreditsUsed = subscription.segment_credits_used + totalSegments;
    const { error: creditError } = await supabase
      .from("subscriptions")
      .update({ segment_credits_used: newCreditsUsed })
      .eq("id", subscription.id)
      .eq("segment_credits_used", subscription.segment_credits_used); // Optimistic locking

    if (creditError) {
      console.error("[segments/batch] Credit deduction error:", creditError);
      return NextResponse.json(error("CREDIT_ERROR", "Failed to deduct credits. Please try again."), { status: 500 });
    }

    // Create segment batch record
    const { data: batch, error: batchError } = await supabase
      .from("segment_batches")
      .insert({
        user_id: user.id,
        product_id,
        persona_id,
        status: "pending",
        total_segments: totalSegments,
        completed_segments: 0,
        credits_used: totalSegments,
        credits_refunded: 0,
      })
      .select()
      .single();

    if (batchError || !batch) {
      // Refund credits if batch creation failed
      await supabase
        .from("subscriptions")
        .update({ segment_credits_used: subscription.segment_credits_used })
        .eq("id", subscription.id);

      console.error("[segments/batch] Batch creation error:", batchError);
      return NextResponse.json(error("DB_ERROR", "Failed to create segment batch"), { status: 500 });
    }

    // Create individual segment records
    const segmentRecords: Array<{
      batch_id: string;
      user_id: string;
      type: string;
      status: string;
      retry_count: number;
    }> = [];

    for (const segReq of segmentRequests) {
      for (let i = 0; i < segReq.count; i++) {
        segmentRecords.push({
          batch_id: batch.id,
          user_id: user.id,
          type: segReq.type,
          status: "pending",
          retry_count: 0,
        });
      }
    }

    const { error: segmentsError } = await supabase.from("segments").insert(segmentRecords);

    if (segmentsError) {
      console.error("[segments/batch] Segments creation error:", segmentsError);
      // Batch is already created, segments failed — mark batch as failed
      await supabase.from("segment_batches").update({ status: "failed" }).eq("id", batch.id);
      return NextResponse.json(error("DB_ERROR", "Failed to create segment records"), { status: 500 });
    }

    // Record the credit transaction
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      subscription_id: subscription.id,
      batch_id: batch.id,
      type: "generation_debit",
      amount: -totalSegments,
      balance_after: availableCredits - totalSegments,
      description: `Generated ${totalSegments} segment(s) in batch ${batch.id}`,
    });

    // Send Inngest event for async generation
    await inngest.send({
      name: "app/segments.generate",
      data: {
        batchId: batch.id,
        userId: user.id,
        productId: product_id,
        personaId: persona_id,
      },
    });

    return NextResponse.json(success(batch), { status: 201 });
  } catch (err) {
    console.error("[segments/batch] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
