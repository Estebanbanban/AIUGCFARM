"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { scrapeRequestSchema } from "@/schemas/scrape";
import { cn } from "@/lib/utils";

interface UrlInputCtaProps {
  className?: string;
}

export function UrlInputCta({ className }: UrlInputCtaProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = scrapeRequestSchema.safeParse({ url });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please enter a valid URL");
      return;
    }

    localStorage.setItem("pendingScrapeUrl", url);
    router.push("/signup");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex w-full flex-col gap-3", className)}
    >
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://your-store.com"
            className={cn(
              "h-12 w-full rounded-lg border bg-zinc-900/50 px-4 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 outline-none",
              error
                ? "border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                : "border-white/10 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            )}
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 gap-2 bg-violet-600 px-6 text-white hover:bg-violet-500 shrink-0"
        >
          Analyze My Store
          <ArrowRight className="size-4" />
        </Button>
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </form>
  );
}
