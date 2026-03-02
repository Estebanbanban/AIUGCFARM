"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  User,
  ShoppingBag,
  Film,
  Clock,
  Settings,
  CreditCard,
  Menu,
  LogOut,
  Plus,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import { useProducts } from "@/hooks/use-products";
import { usePersonas } from "@/hooks/use-personas";
import { useGenerations } from "@/hooks/use-generations";
import { PLANS } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Logo } from "@/components/ui/Logo";
import { useGenerationNotifications } from "@/hooks/use-generation-notifications";
import { OfferCountdownBanner } from "@/components/offers/OfferCountdownBanner";
import { useFirstPurchaseOffer } from "@/hooks/use-first-purchase-offer";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Personas", href: "/personas", icon: User },
  { label: "Brand", href: "/products", icon: ShoppingBag },
  { label: "Generate", href: "/generate", icon: Film },
  { label: "History", href: "/history", icon: Clock },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
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
  const { data: credits } = useCredits();
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
  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const plan = profile?.plan ?? "free";
  const creditsTotal =
    plan !== "free" ? (PLANS[plan as keyof typeof PLANS]?.credits ?? 0) : 9;
  // Cap at 100% - remaining can exceed plan allocation when trial + subscription credits stack
  const creditPercent = isUnlimitedCredits
    ? 100
    : creditsTotal > 0
      ? Math.min(100, Math.round((creditsRemaining / creditsTotal) * 100))
      : 0;
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
            <Sparkles className="size-4 shrink-0" />
            <span className="flex-1 text-left">Get Started</span>
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
              {onboardingStepsDone}/3
            </span>
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-4">
        <div className="rounded-lg border border-sidebar-border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Credits</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-medium text-foreground">
                {isUnlimitedCredits ? "Unlimited" : creditsRemaining}
              </span>
              <Link
                href="/settings/billing"
                onClick={onNavigate}
                className="flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                aria-label="Buy credits"
                title="Buy credits"
              >
                <Plus className="size-2.5" />
              </Link>
            </div>
          </div>
          <Progress
            value={creditPercent}
            className="mt-2 h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-muted-foreground transition-colors hover:text-foreground"
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
  if (pathname.startsWith("/personas/")) return "Persona Detail";
  if (pathname.startsWith("/products/")) return "Product Detail";
  if (pathname.startsWith("/generate/")) return "Generation";
  return "Dashboard";
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = getPageTitle(pathname);
  useGenerationNotifications();

  const offer = useFirstPurchaseOffer();
  const [bannerDismissed, setBannerDismissed] = useState(true);
  useEffect(() => {
    setBannerDismissed(localStorage.getItem("offer_banner_dismissed") === "true");
  }, []);
  // Re-check dismissed state periodically (in case user dismisses from banner)
  useEffect(() => {
    const id = setInterval(() => {
      setBannerDismissed(localStorage.getItem("offer_banner_dismissed") === "true");
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const bannerVisible = offer.isActive && !bannerDismissed;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
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
        <OfferCountdownBanner />
        <header
          className={cn(
            "sticky z-10 flex h-16 items-center justify-between border-b border-border bg-background/75 px-4 backdrop-blur-xl md:px-6",
            bannerVisible ? "top-[44px]" : "top-0",
          )}
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

        <main className={cn("flex-1 overflow-y-auto", bannerVisible && "pt-[44px]")}>
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
