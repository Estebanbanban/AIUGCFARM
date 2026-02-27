import { getAdminClient } from "./supabase.ts";

export const ADMIN_UNLIMITED_CREDITS = 2_147_483_647;

async function isAdminUser(userId: string): Promise<boolean> {
  const sb = getAdminClient();
  const { data } = await sb
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "admin";
}

/** Return the remaining credit count for a user (0 if no row). */
export async function checkCredits(userId: string): Promise<number> {
  const sb = getAdminClient();
  const [{ data: profile }, { data: balance }] = await Promise.all([
    sb
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle(),
    sb
      .from("credit_balances")
      .select("remaining")
      .eq("owner_id", userId)
      .maybeSingle(),
  ]);

  if (profile?.role === "admin") return ADMIN_UNLIMITED_CREDITS;
  return balance?.remaining ?? 0;
}

/** Debit 1 credit from a user. Inserts a ledger entry and decrements the balance. */
export async function debitCredit(
  userId: string,
  referenceId: string,
): Promise<void> {
  if (await isAdminUser(userId)) return;

  const sb = getAdminClient();

  // Insert ledger entry
  const { error: ledgerErr } = await sb.from("credit_ledger").insert({
    owner_id: userId,
    amount: -1,
    reason: "generation",
    reference_id: referenceId,
  });
  if (ledgerErr) throw new Error(`Ledger insert failed: ${ledgerErr.message}`);

  // Decrement balance atomically via raw SQL (service role)
  const { error: rpcErr } = await sb.rpc("decrement_credits", {
    p_user_id: userId,
    p_amount: 1,
  });
  if (rpcErr) throw new Error(`Credit decrement failed: ${rpcErr.message}`);
}

/** Debit N credits from a user. Inserts a ledger entry and decrements the balance atomically. */
export async function debitCredits(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  if (await isAdminUser(userId)) return;

  const sb = getAdminClient();

  // Insert ledger entry
  const { error: ledgerErr } = await sb.from("credit_ledger").insert({
    owner_id: userId,
    amount: -amount,
    reason: "generation",
    reference_id: referenceId,
  });
  if (ledgerErr) throw new Error(`Ledger insert failed: ${ledgerErr.message}`);

  // Decrement balance atomically
  const { error: rpcErr } = await sb.rpc("decrement_credits", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (rpcErr) throw new Error(`Credit decrement failed: ${rpcErr.message}`);
}

/** Refund N credits to a user. Inserts a positive ledger entry and increments the balance. */
export async function refundCredits(
  userId: string,
  amount: number,
  referenceId: string,
): Promise<void> {
  if (await isAdminUser(userId)) return;

  const sb = getAdminClient();

  // Insert ledger entry (positive amount for refund)
  const { error: ledgerErr } = await sb.from("credit_ledger").insert({
    owner_id: userId,
    amount: amount,
    reason: "refund",
    reference_id: referenceId,
  });
  if (ledgerErr) throw new Error(`Refund ledger insert failed: ${ledgerErr.message}`);

  // Increment balance (negative p_amount = increment)
  const { error: rpcErr } = await sb.rpc("decrement_credits", {
    p_user_id: userId,
    p_amount: -amount,
  });
  if (rpcErr) throw new Error(`Credit refund failed: ${rpcErr.message}`);
}
