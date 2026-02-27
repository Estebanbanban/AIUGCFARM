"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Link as LinkIcon } from "lucide-react";
import { fadeInUp } from "@/lib/animations";

export function UrlInputCta({ inverted = false }: { inverted?: boolean }) {
  const [url, setUrl] = useState("");

  return (
    <motion.div {...fadeInUp} className="w-full max-w-xl mx-auto">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) {
            localStorage.setItem("pendingScrapeUrl", url);
            window.location.href = "/signup";
          }
        }}
        className={`flex items-center gap-2 rounded-xl border p-1.5 shadow-lg ${
          inverted
            ? "bg-white/10 border-white/20"
            : "bg-white border-border shadow-black/5"
        }`}
      >
        <div className="flex items-center gap-2 flex-1 px-3">
          <LinkIcon
            className={`size-4 shrink-0 ${
              inverted ? "text-white/40" : "text-muted-foreground"
            }`}
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste your product or store URL..."
            className={`flex-1 bg-transparent text-sm outline-none placeholder:text-sm ${
              inverted
                ? "text-white placeholder:text-white/40"
                : "text-foreground placeholder:text-muted-foreground"
            }`}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shrink-0"
        >
          Get Started
          <ArrowRight className="size-4" />
        </button>
      </form>
    </motion.div>
  );
}
