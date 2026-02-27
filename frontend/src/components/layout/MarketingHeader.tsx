"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className="fixed left-0 right-0 top-3 z-50 px-3 sm:px-5">
        <div
          className={`mx-auto h-16 max-w-7xl rounded-full border px-5 sm:px-7 transition-all duration-300 ${
            scrolled
              ? "border-[#3a3a3a] bg-black/88 shadow-[0_8px_22px_rgba(0,0,0,0.35)] backdrop-blur-xl"
              : "border-[#2a2a2a] bg-black/78 backdrop-blur-xl"
          } flex items-center justify-between`}
        >
          {/* Logo */}
          <Link href="/" className="text-lg font-bold text-white tracking-tight">
            CineRads
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "Blog", href: "/blog" },
              { label: "FAQ", href: "#faq" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm text-[#B3B3B3] hover:text-white transition-colors duration-200"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-[#B3B3B3] hover:text-white transition-colors duration-200"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-full border border-primary/90 px-4 py-2 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary hover:text-white"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-white"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between h-16 px-4">
              <span className="text-lg font-bold text-white">CineRads</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-white"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 px-4 pt-8">
              {[
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Blog", href: "/blog" },
                { label: "FAQ", href: "#faq" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                >
                  <Link
                    href={item.href}
                    className="block py-3 text-2xl font-medium text-white border-b border-[#222]"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 flex flex-col gap-3"
              >
                <Link
                  href="/login"
                  className="text-center py-3 border border-[#333] rounded-full text-white text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-center py-3 bg-white text-black rounded-full text-sm font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  Get Started
                </Link>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
