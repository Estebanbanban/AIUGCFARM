"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import type { UserRow } from "@/lib/admin/queries";
import { UserActionsModal } from "./UserActionsModal";

const PLANS = ["", "free", "starter", "growth", "scale"];

interface Props {
  rows: UserRow[];
  total: number;
  page: number;
  perPage: number;
}

export function UsersTable({ rows, total, page, perPage }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [, startTransition] = useTransition();

  function applyFilters(p = 1) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (planFilter) params.set("plan", planFilter);
    if (activeOnly) params.set("active", "1");
    params.set("page", String(p));
    startTransition(() => router.push(`/admin/users?${params.toString()}`));
  }

  const totalPages = Math.ceil(total / perPage);

  function planBadge(plan: string) {
    const colors: Record<string, string> = {
      free: "text-muted-foreground bg-muted/40",
      starter: "text-blue-400 bg-blue-400/10",
      growth: "text-primary bg-primary/10",
      scale: "text-purple-400 bg-purple-400/10",
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[plan] ?? ""}`}>
        {plan}
      </span>
    );
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          placeholder="Rechercher par email..."
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : "Tous les plans"}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer px-3 py-2 rounded-lg border border-border">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-primary"
          />
          Actifs seulement
        </label>
        <button
          onClick={() => applyFilters()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Filtrer
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">User</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Plan</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Crédits</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium hidden md:table-cell">Générations</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium hidden lg:table-cell">Inscrit</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Statut</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} className="size-7 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="size-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0">
                          {(user.full_name ?? user.email)[0].toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-foreground text-xs font-medium truncate max-w-[140px]">{user.email}</p>
                        {user.full_name && (
                          <p className="text-muted-foreground text-xs truncate max-w-[140px]">{user.full_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{planBadge(user.plan)}</td>
                  <td className="px-5 py-3 text-foreground hidden md:table-cell">{user.credits}</td>
                  <td className="px-5 py-3 text-foreground hidden md:table-cell">{user.generations}</td>
                  <td className="px-5 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(user.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-5 py-3">
                    {user.banned_at ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">Banni</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Actif</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-muted-foreground text-sm">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">{total} utilisateur{total > 1 ? "s" : ""}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => applyFilters(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages || 1}</span>
            <button
              onClick={() => applyFilters(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {selectedUser && (
        <UserActionsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
