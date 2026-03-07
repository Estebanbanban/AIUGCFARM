/**
 * ONE-TIME MIGRATION: Backfill clerk_user_id for all profiles that have a null
 * clerk_user_id. Matches by email between Clerk users and Supabase profiles.
 *
 * Protected by ADMIN_BACKFILL_SECRET env var. Call with:
 *   curl -X POST https://www.cinerads.com/api/admin/backfill-clerk-ids \
 *     -H "x-admin-secret: YOUR_SECRET"
 *
 * Delete this file after the migration is complete.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_BACKFILL_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clerk = await clerkClient();
  const supabase = createAdminClient();

  let offset = 0;
  const limit = 100;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  while (true) {
    const { data: clerkUsers, totalCount } = await clerk.users.getUserList({ limit, offset });
    if (!clerkUsers.length) break;

    for (const user of clerkUsers) {
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) { totalSkipped++; continue; }

      const { data: profile, error: selectErr } = await supabase
        .from("profiles")
        .select("id, clerk_user_id")
        .eq("email", email)
        .maybeSingle();

      if (selectErr) { errors.push(`select error for ${email}: ${selectErr.message}`); continue; }
      if (!profile) { totalSkipped++; continue; }
      if (profile.clerk_user_id === user.id) { totalSkipped++; continue; }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ clerk_user_id: user.id })
        .eq("id", profile.id);

      if (updateErr) {
        errors.push(`update error for ${email}: ${updateErr.message}`);
      } else {
        totalUpdated++;
      }
    }

    offset += clerkUsers.length;
    if (offset >= (totalCount ?? 0)) break;
  }

  return NextResponse.json({ totalUpdated, totalSkipped, errors });
}
