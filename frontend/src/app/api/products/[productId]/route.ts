import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProductSchema } from "@/schemas/product";
import { success, error } from "@/types/api";

type RouteParams = { params: Promise<{ productId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { productId } = await params;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    const { data: product, error: dbError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (dbError || !product) {
      return NextResponse.json(error("NOT_FOUND", "Product not found"), { status: 404 });
    }

    return NextResponse.json(success(product));
  } catch (err) {
    console.error("[products/GET/:id] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { productId } = await params;
    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);
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
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Product not found"), { status: 404 });
    }

    const { data: product, error: dbError } = await supabase
      .from("products")
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq("id", productId)
      .select()
      .single();

    if (dbError) {
      console.error("[products/PATCH] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to update product"), { status: 500 });
    }

    return NextResponse.json(success(product));
  } catch (err) {
    console.error("[products/PATCH] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { productId } = await params;
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
      .from("products")
      .select("id")
      .eq("id", productId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Product not found"), { status: 404 });
    }

    // Soft delete
    const { error: dbError } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (dbError) {
      console.error("[products/DELETE] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to delete product"), { status: 500 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (err) {
    console.error("[products/DELETE] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
