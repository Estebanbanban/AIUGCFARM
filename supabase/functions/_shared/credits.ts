import { getAdminClient } from "./supabase.ts";

/** Return the remaining credit count for a user (0 if no row). */
export async function checkCredits(userId: string): Promise<number> {
  const sb = getAdminClient();
  const { data } = await sb
    .from("credit_balances")
    .select("remaining")
    .eq("owner_id", userId)
    .single();
  return data?.remaining ?? 0;
}

/** Debit 1 credit from a user. Inserts a ledger entry and decrements the balance. */
export async function debitCredit(
  userId: string,
  referenceId: string,
): Promise<void> {
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
