"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "./product-card";
import { callEdge } from "@/lib/api";
import { toast } from "sonner";
import {
  ShieldAlert,
  PackageSearch,
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Users,
  Target,
} from "lucide-react";
import type { ScrapeProduct, ScrapeResponseData, ConfirmProductsResponse } from "@/types/api";

interface ScrapeResultsProps {
  data: ScrapeResponseData;
  isAuthenticated: boolean;
  onSignUpClick: () => void;
  onRetry: () => void;
}

export function ScrapeResults({ data, isAuthenticated, onSignUpClick, onRetry }: ScrapeResultsProps) {
  const [products, setProducts] = useState<ScrapeProduct[]>(data.products);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  function handleProductEdit(index: number, updated: ScrapeProduct) {
    setProducts((prev) => prev.map((p, i) => (i === index ? updated : p)));
  }

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      await callEdge<ConfirmProductsResponse>("confirm-products", {
        body: { products },
      });
      setIsConfirmed(true);
      toast.success("Products saved successfully!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save products";
      toast.error(message);
    } finally {
      setIsConfirming(false);
    }
  }

  // Blocked by robots state
  if (data.blocked_by_robots) {
    return (
      <div className="mx-auto max-w-2xl px-4 text-center">
        <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-8">
          <ShieldAlert className="mx-auto mb-4 size-12 text-yellow-500" />
          <h3 className="text-xl font-semibold text-white">Site Blocked by Robots.txt</h3>
          <p className="mt-3 text-sm text-zinc-400">
            This website&apos;s robots.txt file prevents automated scraping. You can still add your
            products manually by uploading images and filling in the details.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onRetry} variant="ghost" className="gap-2 text-zinc-400 hover:text-white">
              <ArrowLeft className="size-4" />
              Try Another URL
            </Button>
            <Button className="gap-2 bg-violet-600 text-white hover:bg-violet-500">
              <Upload className="size-4" />
              Upload Manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Empty state — no products found
  if (products.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 text-center">
        <div className="rounded-2xl border border-white/5 bg-zinc-900/40 p-8">
          <PackageSearch className="mx-auto mb-4 size-12 text-zinc-600" />
          <h3 className="text-xl font-semibold text-white">No Products Found</h3>
          <p className="mt-3 text-sm text-zinc-400">
            We couldn&apos;t detect any products on that page. Try pasting a direct product or
            collection URL, or upload your products manually.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onRetry} variant="ghost" className="gap-2 text-zinc-400 hover:text-white">
              <ArrowLeft className="size-4" />
              Try Another URL
            </Button>
            <Button className="gap-2 bg-violet-600 text-white hover:bg-violet-500">
              <Upload className="size-4" />
              Upload Manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* Brand Summary */}
      {data.brand_summary && (
        <div className="mb-8 rounded-2xl border border-violet-500/10 bg-violet-500/5 p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <Sparkles className="size-5 text-violet-400" />
            Brand Analysis
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Tone */}
            <div className="flex items-start gap-3">
              <Target className="mt-0.5 size-4 shrink-0 text-violet-400" />
              <div>
                <p className="text-xs text-zinc-500">Tone</p>
                <Badge className="mt-1 bg-violet-600/20 text-violet-300 hover:bg-violet-600/20">
                  {data.brand_summary.tone}
                </Badge>
              </div>
            </div>
            {/* Demographic */}
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 size-4 shrink-0 text-violet-400" />
              <div>
                <p className="text-xs text-zinc-500">Target Demographic</p>
                <p className="mt-1 text-sm text-zinc-300">{data.brand_summary.demographic}</p>
              </div>
            </div>
            {/* Selling Points */}
            <div>
              <p className="text-xs text-zinc-500">Selling Points</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.brand_summary.selling_points.map((point) => (
                  <Badge
                    key={point}
                    variant="outline"
                    className="border-white/10 text-xs text-zinc-300"
                  >
                    {point}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Brand analysis error notice */}
      {data.brand_summary_error && !data.brand_summary && (
        <div className="mb-8 flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-yellow-500" />
          <p className="text-sm text-zinc-400">
            Brand analysis unavailable: {data.brand_summary_error}
          </p>
        </div>
      )}

      {/* Product count header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-white">
            {products.length} Product{products.length !== 1 ? "s" : ""} Found
          </h3>
          <Badge
            className={
              data.source === "shopify"
                ? "bg-green-600/20 text-green-400 hover:bg-green-600/20"
                : "bg-zinc-600/20 text-zinc-400 hover:bg-zinc-600/20"
            }
          >
            {data.source === "shopify" ? "Shopify" : "Generic"}
          </Badge>
        </div>
        <Button onClick={onRetry} variant="ghost" size="sm" className="gap-2 text-zinc-400 hover:text-white">
          <ArrowLeft className="size-3.5" />
          New URL
        </Button>
      </div>

      {/* Product grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product, index) => (
          <ProductCard
            key={product.id ?? index}
            product={product}
            editable={isAuthenticated && !isConfirmed}
            onEdit={(updated) => handleProductEdit(index, updated)}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex flex-col items-center gap-4">
        {isConfirmed ? (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 className="size-5" />
            <span className="text-sm font-medium">Products saved! Head to your dashboard to continue.</span>
          </div>
        ) : isAuthenticated ? (
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            size="lg"
            className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
          >
            {isConfirming ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-4" />
                Confirm & Save Products
              </>
            )}
          </Button>
        ) : (
          <div className="text-center">
            <p className="mb-3 text-sm text-zinc-400">
              Sign up to save these products and start generating UGC ads
            </p>
            <Button
              onClick={onSignUpClick}
              size="lg"
              className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
            >
              Sign Up to Save
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
