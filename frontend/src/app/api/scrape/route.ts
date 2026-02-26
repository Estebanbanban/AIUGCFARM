import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest";
import { scrapeRequestSchema } from "@/schemas/scrape";
import { success, error } from "@/types/api";

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    const body = await req.json();
    const parsed = scrapeRequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return NextResponse.json(
        error("VALIDATION_ERROR", firstError?.message ?? "Invalid input", firstError?.path.join(".")),
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    // If user is authenticated, resolve internal user ID
    let internalUserId: string | null = null;
    if (clerkUserId) {
      const supabase = createAdminClient();
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", clerkUserId)
        .single();
      internalUserId = user?.id ?? null;
    }

    // Send Inngest event for async scraping
    await inngest.send({
      name: "app/scrape.requested",
      data: { url, userId: internalUserId },
    });

    return NextResponse.json(success({ jobId: "pending" }));
  } catch (err) {
    console.error("[scrape] Error:", err);
    return NextResponse.json(error("INTERNAL_ERROR", "Failed to initiate scrape"), { status: 500 });
  }
}
