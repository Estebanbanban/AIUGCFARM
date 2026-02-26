import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { success, error } from "@/types/api";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { batchId } = await params;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    // Fetch batch with ownership check
    const { data: batch, error: batchError } = await supabase
      .from("segment_batches")
      .select("*")
      .eq("id", batchId)
      .eq("user_id", user.id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json(error("NOT_FOUND", "Segment batch not found"), { status: 404 });
    }

    // Fetch all segments belonging to this batch
    const { data: segments, error: segmentsError } = await supabase
      .from("segments")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    if (segmentsError) {
      console.error("[segments/GET/:batchId] Segments query error:", segmentsError);
      return NextResponse.json(error("DB_ERROR", "Failed to fetch segments"), { status: 500 });
    }

    return NextResponse.json(success({ ...batch, segments: segments ?? [] }));
  } catch (err) {
    console.error("[segments/GET/:batchId] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
