"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Film,
  Clock,
  Settings,
  Menu,
  LogOut,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/use-profile";
import { useProducts } from "@/hooks/use-products";
import { usePersonas } from "@/hooks/use-personas";
import { useGenerations } from "@/hooks/use-generations";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Logo } from "@/components/ui/Logo";
import { useGenerationNotifications } from "@/hooks/use-generation-notifications";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Generate", href: "/generate", icon: Film },
  { label: "History", href: "/history", icon: Clock },
  { label: "Settings", href: "/settings", icon: Settings },
];

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/personas": "Personas",
  "/products": "Brand",
  "/generate": "Generate",
  "/history": "History",
  "/settings": "Settings",
  "/settings/billing": "Billing",
};

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: products } = useProducts();
  const { data: personas } = usePersonas();
  const { data: generations } = useGenerations();
  const onboardingStepsDone = [
    (products?.length ?? 0) > 0,
    (personas ?? []).some((p) => p.selected_image_url != null),
    (generations ?? []).some((g) => g.status === "completed"),
  ].filter(Boolean).length;
  const allOnboardingDone = onboardingStepsDone === 3;
  const userEmail = profile?.email ?? "";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "global" });
    localStorage.setItem("force_account_select", "1");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-6">
        <Link href="/" onClick={onNavigate}>
          <Logo variant="full" size="sm" theme="auto" />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const hasMoreSpecificMatch = navItems.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(item.href) &&
              pathname.startsWith(other.href)
          );
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              pathname.startsWith(item.href) &&
              !hasMoreSpecificMatch);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-border bg-sidebar-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {!allOnboardingDone && (
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              onNavigate?.();
              window.dispatchEvent(new CustomEvent("onboarding:resume"));
            }}
            className="flex w-full items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <span className="flex-1 text-left">Get Started</span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
              {onboardingStepsDone}/3
            </span>
          </button>
        </div>
      )}

      <div className="border-t border-sidebar-border px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname === "/personas/new") return "Create Persona";
  if (pathname.startsWith("/personas/")) return "Persona Detail";
  if (pathname.startsWith("/products/")) return "Product Detail";
  if (pathname.startsWith("/generate/")) return "Generation";
  return "Dashboard";
}

export function DashboardShell({ children, className }: { children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);
  useGenerationNotifications();


  return (
    <div className={cn("flex flex-1 min-h-0 overflow-hidden bg-background text-foreground", className)}>
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
        <SidebarContent pathname={pathname} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden bg-background-secondary">
        <header
          className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/75 px-4 backdrop-blur-xl md:px-6"
        >
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
            <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/generate">
                <Plus className="size-4" />
                New Generation
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
