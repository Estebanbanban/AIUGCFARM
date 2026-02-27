"use client";

import { useState } from "react";
import { X, Shield, ShieldOff, CreditCard, UserCheck } from "lucide-react";
import type { UserRow } from "@/lib/admin/queries";

interface Props {
  user: UserRow;
  onClose: () => void;
  onSuccess: () => void;
}

const PLANS = ["free", "starter", "growth", "scale"];

export function UserActionsModal({ user, onClose, onSuccess }: Props) {
  const [plan, setPlan] = useState(user.plan);
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState<"bonus" | "refund">("bonus");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePlanChange() {
    if (plan === user.plan) return;
    setLoading("plan");
    setError(null);
    const res = await fetch("/api/admin/users/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, plan }),
    });
    setLoading(null);
    if (!res.ok) return setError("Erreur lors du changement de plan");
    onSuccess();
    onClose();
  }

  async function handleCreditAdjust() {
    if (!creditAmount) return;
    setLoading("credits");
    setError(null);
    const res = await fetch("/api/admin/users/credits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, amount: Number(creditAmount), reason: creditReason }),
    });
    setLoading(null);
    if (!res.ok) return setError("Erreur lors de l'ajustement des crédits");
    onSuccess();
    onClose();
  }

  async function handleBanToggle() {
    setLoading("ban");
    setError(null);
    const action = user.banned_at ? "unban" : "ban";
    const res = await fetch(`/api/admin/users/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    setLoading(null);
    if (!res.ok) return setError("Erreur lors du ban/unban");
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} className="size-9 rounded-full object-cover" alt="" />
            ) : (
              <div className="size-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                {(user.full_name ?? user.email)[0].toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium text-foreground text-sm">{user.full_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
          )}

          {/* Current stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className="text-lg font-bold text-foreground">{user.credits}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Crédits</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className="text-lg font-bold text-foreground">{user.generations}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Générations</p>
            </div>
            <div className="rounded-lg bg-muted/30 p-2.5">
              <p className={`text-lg font-bold capitalize ${user.plan === "free" ? "text-muted-foreground" : "text-primary"}`}>
                {user.plan}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Plan</p>
            </div>
          </div>

          {/* Change plan */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <UserCheck className="size-3.5" /> Changer le plan
            </p>
            <div className="flex gap-2">
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={handlePlanChange}
                disabled={loading === "plan" || plan === user.plan}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 transition-opacity"
              >
                {loading === "plan" ? "..." : "Appliquer"}
              </button>
            </div>
          </div>

          {/* Adjust credits */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <CreditCard className="size-3.5" /> Ajuster les crédits
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                placeholder="ex: 10 ou -5"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <select
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value as "bonus" | "refund")}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="bonus">Bonus</option>
                <option value="refund">Refund</option>
              </select>
            </div>
            <button
              onClick={handleCreditAdjust}
              disabled={loading === "credits" || !creditAmount}
              className="w-full rounded-lg border border-border py-2 text-sm text-foreground hover:bg-muted/40 disabled:opacity-50 transition-colors"
            >
              {loading === "credits" ? "..." : `${creditAmount >= 0 ? "+" : ""}${creditAmount} crédits`}
            </button>
          </div>

          {/* Ban */}
          <div className="pt-2 border-t border-border">
            <button
              onClick={handleBanToggle}
              disabled={loading === "ban"}
              className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                user.banned_at
                  ? "border border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
                  : "border border-destructive/40 text-destructive hover:bg-destructive/10"
              }`}
            >
              {user.banned_at ? <ShieldOff className="size-4" /> : <Shield className="size-4" />}
              {loading === "ban" ? "..." : user.banned_at ? "Débannir l'utilisateur" : "Bannir l'utilisateur"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
