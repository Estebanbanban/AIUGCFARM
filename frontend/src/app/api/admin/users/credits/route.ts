import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { adjustUserCredits } from "@/lib/admin/queries";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { userId, amount, reason } = await req.json();
  if (!userId || amount === undefined) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  await adjustUserCredits(userId, amount, reason ?? "bonus");
  return NextResponse.json({ ok: true });
}
