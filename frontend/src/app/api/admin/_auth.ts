import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function requireAdmin() {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {};
}
