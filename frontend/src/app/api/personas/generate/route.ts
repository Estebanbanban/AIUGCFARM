import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest";
import { success, error } from "@/types/api";
import { z } from "zod";

const generateSchema = z.object({
  persona_id: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json(error("UNAUTHORIZED", "Authentication required"), { status: 401 });
    }

    const body = await req.json();
    const parsed = generateSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        error("VALIDATION_ERROR", firstError?.message ?? "Invalid input", firstError?.path.join(".")),
        { status: 400 }
      );
    }

    const { persona_id } = parsed.data;
    const supabase = createAdminClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkUserId)
      .single();

    if (!user) {
      return NextResponse.json(error("USER_NOT_FOUND", "User not found"), { status: 404 });
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

    // Send Inngest event for async image generation
    await inngest.send({
      name: "app/persona.generate-images",
      data: { personaId: persona_id, userId: user.id },
    });

    return NextResponse.json(success({ status: "generating" }));
  } catch (err) {
    console.error("[personas/generate] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to initiate persona image generation"), { status: 500 });
  }
}
