import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../_auth";
import { unbanUser } from "@/lib/admin/queries";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  await unbanUser(userId);
  return NextResponse.json({ ok: true });
}
