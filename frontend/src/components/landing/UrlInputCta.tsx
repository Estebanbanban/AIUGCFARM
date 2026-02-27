"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { scrapeRequestSchema } from "@/schemas/scrape";
import { callEdgePublic } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ScrapeResponseData } from "@/types/api";

interface UrlInputCtaProps {
  className?: string;
  onScrapeComplete?: (data: ScrapeResponseData) => void;
}

export function UrlInputCta({ className, onScrapeComplete }: UrlInputCtaProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = scrapeRequestSchema.safeParse({ url });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    try {
      const response = await callEdgePublic<{ data: ScrapeResponseData }>("scrape-product", {
        body: { url: result.data.url },
      });
      onScrapeComplete?.(response.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex w-full flex-col gap-3", className)}>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (error) setError(null); }}
            placeholder="https://your-store.com"
            disabled={isLoading}
            className={cn(
              "h-12 w-full rounded-lg border bg-zinc-900/50 px-4 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 outline-none disabled:opacity-50",
              error
                ? "border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                : "border-white/10 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            )}
          />
        </div>
        <Button type="submit" size="lg" disabled={isLoading} className="h-12 gap-2 bg-violet-600 px-6 text-white hover:bg-violet-500 shrink-0">
          {isLoading ? (<><Loader2 className="size-4 animate-spin" />Analyzing...</>) : (<>Analyze My Store<ArrowRight className="size-4" /></>)}
        </Button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
