import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createProductSchema } from "@/schemas/product";
import { success, error } from "@/types/api";

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");

    let query = supabase
      .from("products")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (brandId) {
      query = query.eq("brand_id", brandId);
    }

    const { data: products, error: dbError } = await query;

    if (dbError) {
      console.error("[products/GET] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to fetch products"), { status: 500 });
    }

    return NextResponse.json(success(products));
  } catch (err) {
    console.error("[products/GET] Error:", err);
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
    const parsed = createProductSchema.safeParse(body);
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

    // Verify brand ownership
    const { data: brand } = await supabase
      .from("brands")
      .select("id")
      .eq("id", parsed.data.brand_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!brand) {
      return NextResponse.json(error("NOT_FOUND", "Brand not found or does not belong to you"), { status: 404 });
    }

    const { data: product, error: dbError } = await supabase
      .from("products")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (dbError) {
      console.error("[products/POST] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to create product"), { status: 500 });
    }

    return NextResponse.json(success(product), { status: 201 });
  } catch (err) {
    console.error("[products/POST] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
