import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBrandSchema } from "@/schemas/brand";
import { success, error } from "@/types/api";

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

    const { data: brands, error: dbError } = await supabase
      .from("brands")
      .select("*")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("[brands/GET] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to fetch brands"), { status: 500 });
    }

    return NextResponse.json(success(brands));
  } catch (err) {
    console.error("[brands/GET] Error:", err);
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
    const parsed = createBrandSchema.safeParse(body);
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

    const { data: brand, error: dbError } = await supabase
      .from("brands")
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (dbError) {
      console.error("[brands/POST] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to create brand"), { status: 500 });
    }

    return NextResponse.json(success(brand), { status: 201 });
  } catch (err) {
    console.error("[brands/POST] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
