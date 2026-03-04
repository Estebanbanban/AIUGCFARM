import { createClient } from "@supabase/supabase-js";
import { calculateGenerationCost } from "@/lib/generation-cost";

const PLAN_PRICES: Record<string, number> = {
  starter: 25,
  growth: 80,
  scale: 180,
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Admin panel requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
      "to be set in Vercel environment variables."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Overview ────────────────────────────────────────────────────────────────

export async function getOverviewStats() {
  const supabase = getAdminClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    { data: subs },
    { count: totalUsers },
    { count: newThisMonth },
    { count: genToday },
    { data: creditsUsed },
  ] = await Promise.all([
    supabase.from("subscriptions").select("plan, status").eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", monthStart),
    supabase.from("generations").select("*", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("credit_ledger").select("amount").eq("reason", "generation").gte("created_at", monthStart),
  ]);

  const mrr = (subs ?? []).reduce((acc, s) => acc + (PLAN_PRICES[s.plan ?? ""] ?? 0), 0);
  const paidUsers = (subs ?? []).length;
  const conversionRate = totalUsers ? Math.round((paidUsers / totalUsers) * 100) : 0;
  const creditsConsumed = (creditsUsed ?? []).reduce((acc, e) => acc + Math.abs(e.amount), 0);

  return {
    mrr,
    arr: mrr * 12,
    totalUsers: totalUsers ?? 0,
    newThisMonth: newThisMonth ?? 0,
    genToday: genToday ?? 0,
    conversionRate,
    creditsConsumedThisMonth: creditsConsumed,
  };
}

export async function getSignupTimeseries(days = 30) {
  const supabase = getAdminClient();
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", from)
    .order("created_at", { ascending: true });

  const counts: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  (data ?? []).forEach((r) => {
    const day = r.created_at.slice(0, 10);
    if (day in counts) counts[day]++;
  });
  return Object.entries(counts).map(([date, signups]) => ({ date, signups }));
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export async function getMRRBreakdown() {
  const supabase = getAdminClient();
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("status", "active");

  const breakdown: Record<string, { users: number; mrr: number }> = {
    starter: { users: 0, mrr: 0 },
    growth: { users: 0, mrr: 0 },
    scale: { users: 0, mrr: 0 },
  };
  (subs ?? []).forEach((s) => {
    if (s.plan && breakdown[s.plan]) {
      breakdown[s.plan].users++;
      breakdown[s.plan].mrr += PLAN_PRICES[s.plan];
    }
  });
  return Object.entries(breakdown).map(([plan, v]) => ({ plan, ...v }));
}

export async function getChurnThisMonth() {
  const supabase = getAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: churned } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("status", "canceled")
    .gte("updated_at", monthStart);

  const count = churned?.length ?? 0;
  const mrrLost = (churned ?? []).reduce((acc, s) => acc + (PLAN_PRICES[s.plan ?? ""] ?? 0), 0);
  return { count, mrrLost };
}

export async function getRecentSubscriptions(limit = 20) {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id, plan, status, created_at, owner_id, profiles(email, full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getOneTimeRevenue() {
  const supabase = getAdminClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data } = await supabase
    .from("credit_ledger")
    .select("amount")
    .eq("reason", "credit_pack_purchase" as string)
    .gte("created_at", monthStart);
  return (data ?? []).reduce((acc, e) => acc + Math.abs(e.amount), 0);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: string;
  role: string;
  banned_at: string | null;
  created_at: string;
  credits: number;
  generations: number;
}

export async function getUsersTable({
  page = 1,
  perPage = 20,
  search = "",
  planFilter = "",
  activeOnly = false,
}: {
  page?: number;
  perPage?: number;
  search?: string;
  planFilter?: string;
  activeOnly?: boolean;
}) {
  const supabase = getAdminClient();
  const offset = (page - 1) * perPage;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, plan, role, banned_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (search) query = query.ilike("email", `%${search}%`);
  if (planFilter) query = query.eq("plan", planFilter);

  const { data: profiles, count } = await query;

  if (!profiles?.length) return { rows: [], total: count ?? 0 };

  const ids = profiles.map((p) => p.id);

  const [{ data: balances }, { data: genCounts }] = await Promise.all([
    supabase.from("credit_balances").select("owner_id, remaining").in("owner_id", ids),
    supabase.from("generations").select("owner_id").in("owner_id", ids),
  ]);

  const balanceMap: Record<string, number> = {};
  (balances ?? []).forEach((b) => { balanceMap[b.owner_id] = b.remaining; });

  const genMap: Record<string, number> = {};
  (genCounts ?? []).forEach((g) => { genMap[g.owner_id] = (genMap[g.owner_id] ?? 0) + 1; });

  let rows: UserRow[] = profiles.map((p) => ({
    ...p,
    credits: balanceMap[p.id] ?? 0,
    generations: genMap[p.id] ?? 0,
  }));

  if (activeOnly) {
    const activeIds = new Set(
      (genCounts ?? [])
        .filter(() => true)
        .map((g) => g.owner_id)
    );
    const { data: recentGens } = await supabase
      .from("generations")
      .select("owner_id")
      .in("owner_id", ids)
      .gte("created_at", thirtyDaysAgo);
    const activeSet = new Set((recentGens ?? []).map((g) => g.owner_id));
    rows = rows.filter((r) => activeSet.has(r.id));
  }

  return { rows, total: count ?? 0 };
}

export async function updateUserPlan(userId: string, plan: string) {
  const supabase = getAdminClient();
  await Promise.all([
    supabase.from("profiles").update({ plan }).eq("id", userId),
    supabase.from("subscriptions").update({ plan }).eq("owner_id", userId),
  ]);
}

export async function adjustUserCredits(userId: string, amount: number, reason: "bonus" | "refund") {
  const supabase = getAdminClient();
  const { data: balance } = await supabase
    .from("credit_balances")
    .select("remaining")
    .eq("owner_id", userId)
    .single();

  const newBalance = Math.max(0, (balance?.remaining ?? 0) + amount);
  await Promise.all([
    supabase.from("credit_balances").update({ remaining: newBalance }).eq("owner_id", userId),
    supabase.from("credit_ledger").insert({ owner_id: userId, amount, reason }),
  ]);
}

export async function banUser(userId: string) {
  const supabase = getAdminClient();
  await supabase.from("profiles").update({ banned_at: new Date().toISOString() }).eq("id", userId);
}

export async function unbanUser(userId: string) {
  const supabase = getAdminClient();
  await supabase.from("profiles").update({ banned_at: null }).eq("id", userId);
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export async function getGenerationTimeseries(days = 30) {
  const supabase = getAdminClient();
  const from = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("generations")
    .select("created_at, status")
    .gte("created_at", from);

  const counts: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    counts[d.toISOString().slice(0, 10)] = 0;
  }
  (data ?? []).forEach((g) => {
    const day = g.created_at.slice(0, 10);
    if (day in counts) counts[day]++;
  });
  return Object.entries(counts).map(([date, generations]) => ({ date, generations }));
}

export async function getGenerationStats() {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("generations")
    .select("status, started_at, completed_at");

  const total = data?.length ?? 0;
  const completed = (data ?? []).filter((g) => g.status === "completed").length;
  const failed = (data ?? []).filter((g) => g.status === "failed").length;

  const durations = (data ?? [])
    .filter((g) => g.started_at && g.completed_at)
    .map((g) => new Date(g.completed_at).getTime() - new Date(g.started_at).getTime());

  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  return {
    total,
    completed,
    failed,
    pending: total - completed - failed,
    successRate: total ? Math.round((completed / total) * 100) : 0,
    avgDurationSec: Math.round(avgMs / 1000),
  };
}

export async function getApiCostStats() {
  const supabase = getAdminClient();
  const { data } = await supabase
    .from("generations")
    .select("videos, video_quality, kling_model")
    .eq("status", "completed");

  let totalCostUsd = 0;
  let totalBilledSeconds = 0;
  const count = (data ?? []).length;

  for (const gen of (data ?? [])) {
    const cost = calculateGenerationCost(gen.videos, gen.video_quality, gen.kling_model);
    totalCostUsd += cost.totalCostUsd;
    totalBilledSeconds += cost.totalBilledSeconds;
  }

  return {
    totalCostUsd,
    totalBilledSeconds,
    count,
    avgCostUsd: count > 0 ? totalCostUsd / count : 0,
  };
}

export async function getProductSourceBreakdown() {
  const supabase = getAdminClient();
  const { data } = await supabase.from("products").select("source");
  const map: Record<string, number> = { shopify: 0, generic: 0, manual: 0 };
  (data ?? []).forEach((p) => { map[p.source] = (map[p.source] ?? 0) + 1; });
  return Object.entries(map).map(([source, count]) => ({ source, count }));
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

export async function getFunnelData(days: number | null = 30) {
  const supabase = getAdminClient();
  const from = days ? new Date(Date.now() - days * 86400000).toISOString() : null;

  const profilesQuery = supabase.from("profiles").select("id", { count: "exact", head: false });
  const productsQuery = supabase.from("products").select("owner_id");
  const personasQuery = supabase.from("personas").select("owner_id");
  const generationsQuery = supabase.from("generations").select("owner_id");
  const subsQuery = supabase.from("subscriptions").select("owner_id").eq("status", "active");

  if (from) {
    profilesQuery.gte("created_at", from);
    productsQuery.gte("created_at", from);
    personasQuery.gte("created_at", from);
    generationsQuery.gte("created_at", from);
  }

  const [
    { data: allUsers },
    { data: productUsers },
    { data: personaUsers },
    { data: genUsers },
    { data: subUsers },
  ] = await Promise.all([profilesQuery, productsQuery, personasQuery, generationsQuery, subsQuery]);

  const signups = allUsers?.length ?? 0;
  const imported = new Set((productUsers ?? []).map((r) => r.owner_id)).size;
  const persona = new Set((personaUsers ?? []).map((r) => r.owner_id)).size;
  const generated = new Set((genUsers ?? []).map((r) => r.owner_id)).size;
  const paid = new Set((subUsers ?? []).map((r) => r.owner_id)).size;

  return [
    { step: "Signup", count: signups, pct: 100 },
    { step: "Produit importé", count: imported, pct: signups ? Math.round((imported / signups) * 100) : 0 },
    { step: "Persona créée", count: persona, pct: signups ? Math.round((persona / signups) * 100) : 0 },
    { step: "1ère génération", count: generated, pct: signups ? Math.round((generated / signups) * 100) : 0 },
    { step: "Converti paid", count: paid, pct: signups ? Math.round((paid / signups) * 100) : 0 },
  ];
}
