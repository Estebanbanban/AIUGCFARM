import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updatePersonaSchema } from "@/schemas/persona";
import { success, error } from "@/types/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ personaId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { personaId } = await params;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
    }

    const { data: persona, error: dbError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (dbError || !persona) {
      return NextResponse.json(error("NOT_FOUND", "Persona not found"), { status: 404 });
    }

    return NextResponse.json(success(persona));
  } catch (err) {
    console.error("[personas/GET/:id] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { personaId } = await params;
    const body = await req.json();

    // Extend the update schema to include selected_image_url
    const patchSchema = updatePersonaSchema.extend({
      selected_image_url: z.string().url().optional(),
    });

    const parsed = patchSchema.safeParse(body);
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
      .from("personas")
      .select("id")
      .eq("id", personaId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Persona not found"), { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    };

    const { data: persona, error: dbError } = await supabase
      .from("personas")
      .update(updateData)
      .eq("id", personaId)
      .select()
      .single();

    if (dbError) {
      console.error("[personas/PATCH] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to update persona"), { status: 500 });
    }

    return NextResponse.json(success(persona));
  } catch (err) {
    console.error("[personas/PATCH] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const { personaId } = await params;
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
      .from("personas")
      .select("id")
      .eq("id", personaId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!existing) {
      return NextResponse.json(error("NOT_FOUND", "Persona not found"), { status: 404 });
    }

    // Soft delete
    const { error: dbError } = await supabase
      .from("personas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", personaId);

    if (dbError) {
      console.error("[personas/DELETE] DB error:", dbError);
      return NextResponse.json(error("DB_ERROR", "Failed to delete persona"), { status: 500 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (err) {
    console.error("[personas/DELETE] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Internal server error"), { status: 500 });
  }
}
