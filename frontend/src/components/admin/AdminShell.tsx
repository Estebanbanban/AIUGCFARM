"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  BarChart2,
  Filter,
  Menu,
  X,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Revenue", href: "/admin/revenue", icon: TrendingUp },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Usage", href: "/admin/usage", icon: BarChart2 },
  { label: "Funnel", href: "/admin/funnel", icon: Filter },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a] border-r border-border">
      {/* Logo + badge */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-border">
        <Link href="/" onClick={onClose}>
          <Logo variant="full" size="sm" theme="dark" />
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 bg-primary/10 rounded px-1.5 py-0.5">
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="size-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-border flex flex-col gap-1">
        <Link
          href="/dashboard"
          onClick={onClose}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to App
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 flex-shrink-0">
            <SidebarContent onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div className="md:hidden flex h-14 items-center justify-between border-b border-border px-4 bg-[#0a0a0a]">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="size-5 text-foreground" />
          </button>
          <Logo variant="full" size="sm" theme="dark" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/40 bg-primary/10 rounded px-1.5 py-0.5">
            ADMIN
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
