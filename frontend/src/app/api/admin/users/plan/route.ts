import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { updateUserPlan } from "@/lib/admin/queries";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { userId, plan } = await req.json();
  if (!userId || !plan) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  await updateUserPlan(userId, plan);
  return NextResponse.json({ ok: true });
}
