"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { createClient } from "@/lib/supabase/client";

interface AuthUser {
  name: string;
  avatar_url: string | null;
}

const navItems = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "#faq" },
];

function UserAvatar({ user }: { user: AuthUser }) {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 transition-colors duration-200 hover:border-border/80 hover:bg-muted/50"
    >
      {user.avatar_url ? (
        <img
          src={user.avatar_url}
          alt={user.name}
          className="size-6 rounded-full object-cover"
        />
      ) : (
        <div className="size-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold flex-shrink-0">
          {user.name[0].toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
        {user.name}
      </span>
    </Link>
  );
}

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .single();
      setAuthUser({
        name:
          profile?.full_name ||
          session.user.email?.split("@")[0] ||
          "Account",
        avatar_url: profile?.avatar_url ?? null,
      });
    };

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          loadUser();
        } else {
          setAuthUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <header className="fixed left-0 right-0 top-3 z-50 px-3 sm:px-5">
        <div
          className={`relative mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border px-5 transition-all duration-300 sm:px-7 ${
            scrolled
              ? "border-border/70 bg-background/75 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
              : "border-border/60 bg-background/60 backdrop-blur-xl"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/40 via-white/10 to-transparent dark:from-white/10 dark:via-white/[0.03]" />

          <Link href="/" className="relative z-10 text-lg font-semibold tracking-tight text-foreground">
            CineRads
          </Link>

          <nav className="relative z-10 hidden items-center gap-8 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="relative z-10 hidden items-center gap-3 md:flex">
            <ThemeToggle />
            {authUser ? (
              <UserAvatar user={authUser} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          <div className="relative z-10 flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              className="text-foreground"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex flex-col bg-background"
          >
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <span className="text-lg font-semibold text-foreground">CineRads</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-foreground"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex flex-col gap-2 px-4 pt-8">
              {navItems.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    href={item.href}
                    className="block border-b border-border py-3 text-2xl font-medium text-foreground"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8 flex flex-col gap-3"
              >
                {authUser ? (
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-3 rounded-full border border-border px-4 py-3"
                    onClick={() => setMobileOpen(false)}
                  >
                    {authUser.avatar_url ? (
                      <img
                        src={authUser.avatar_url}
                        alt={authUser.name}
                        className="size-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold flex-shrink-0">
                        {authUser.name[0].toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {authUser.name}
                    </span>
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="rounded-full border border-border py-3 text-center text-sm text-foreground"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      className="rounded-full bg-primary py-3 text-center text-sm font-medium text-primary-foreground"
                      onClick={() => setMobileOpen(false)}
                    >
                      Start Free
                    </Link>
                  </>
                )}
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
