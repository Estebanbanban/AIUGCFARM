import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateBrandSchema } from "@/schemas/brand";
import { success, error } from "@/types/api";

type RouteParams = { params: Promise<{ brandId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { brandId } = await params;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    const { data: brand, error: dbError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (dbError || !brand) {
      return NextResponse.json(error("NOT_FOUND", "Brand not found"), { status: 404 });
    }

    return NextResponse.json(success(brand));
  } catch (err) {
    console.error("[brands/GET/:id] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { brandId } = await params;
    const body = await req.json();
    const parsed = updateBrandSchema.safeParse(body);
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

    // Verify ownership
    const { data: existing } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Brand not found"), { status: 404 });
    }

    const { data: brand, error: dbError } = await supabase
      .from("brands")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", brandId)
      .select()
      .single();

    if (dbError) {
      console.error("[brands/PATCH] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to update brand"), { status: 500 });
    }

    return NextResponse.json(success(brand));
  } catch (err) {
    console.error("[brands/PATCH] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { brandId } = await params;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("brands")
      .select("id")
      .eq("id", brandId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Brand not found"), { status: 404 });
    }

    // Soft delete
    const { error: dbError } = await supabase
      .from("brands")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", brandId);

    if (dbError) {
      console.error("[brands/DELETE] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to delete brand"), { status: 500 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (err) {
    console.error("[brands/DELETE] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
