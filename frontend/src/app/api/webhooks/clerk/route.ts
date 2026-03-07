import { headers } from "next/headers";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;
  try {
    evt = wh.verify(body, { "svix-id": svix_id, "svix-timestamp": svix_timestamp, "svix-signature": svix_signature });
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  if (evt.type === "user.created") {
    const { id: clerkUserId, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || email?.split("@")[0] || "User";

    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        clerk_user_id: clerkUserId,
        email,
        full_name: fullName,
        avatar_url: image_url,
        plan: "free",
        credits: 3,
      },
      { onConflict: "email", ignoreDuplicates: false }
    );
    if (error) {
      console.error(`[clerk-webhook] user.created upsert failed for clerk_user_id=${clerkUserId}:`, error);
    }
  }

  if (evt.type === "user.updated") {
    const { id: clerkUserId, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses[0]?.email_address;
    const fullName = [first_name, last_name].filter(Boolean).join(" ") || email?.split("@")[0] || "User";

    const supabase = createAdminClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        clerk_user_id: clerkUserId,
        email,
        full_name: fullName,
        avatar_url: image_url,
      },
      { onConflict: "clerk_user_id", ignoreDuplicates: false }
    );
    if (error) {
      console.error(`[clerk-webhook] user.updated upsert failed for clerk_user_id=${clerkUserId}:`, error);
    }
  }

  if (evt.type === "user.deleted") {
    const { id: clerkUserId } = evt.data;
    // Safety net: clean up any remaining profile for this Clerk user.
    // In normal flow, delete-account already removed this row, but this
    // handles manual deletions done directly in the Clerk dashboard.
    if (clerkUserId) {
      const supabase = createAdminClient();
      await supabase.from("profiles").delete().eq("clerk_user_id", clerkUserId);
    }
  }

  return new Response("OK", { status: 200 });
}
