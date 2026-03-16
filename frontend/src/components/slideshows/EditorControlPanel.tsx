"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useProducts } from "@/hooks/use-products";
import { useCollections, useCollectionImages } from "@/hooks/use-collections";
import { HookSelector } from "./HookSelector";
import { SlideTextEditor } from "./SlideTextEditor";
import { GenerateButton } from "./GenerateButton";

export function EditorControlPanel() {
  const store = useSlideshowEditorStore();
  const { data: products = [] } = useProducts();
  const { data: collections = [] } = useCollections();
  const { data: collectionData } = useCollectionImages(store.selectedCollectionId);

  // Combined: auto-select product THEN auto-select collection (no race condition)
  useEffect(() => {
    // Step 1: Auto-select product if not set
    if (products.length >= 1 && !store.productId) {
      store.setProductId(products[0].id);
      return; // Let the effect re-fire with the new productId
    }

    // Step 2: Auto-select collection (only after product is resolved)
    if (collections.length === 0) return;
    if (store.selectedCollectionId) return; // already picked

    // Wait for product to be set before matching
    if (products.length > 0 && !store.productId) return;

    // Build search text from ALL product fields
    const selectedProduct = products.find((p) => p.id === store.productId);
    const productFields = [
      selectedProduct?.name ?? "",
      selectedProduct?.description ?? "",
      (selectedProduct as any)?.category ?? "",
      (selectedProduct as any)?.brand_summary?.product_category ?? "",
      (selectedProduct as any)?.brand_summary?.tone ?? "",
      (selectedProduct as any)?.store_url ?? "",
    ];
    const productText = productFields.join(" ").toLowerCase();

    // Niche keywords — each niche maps to its collection name pattern AND search keywords
    const nicheKeywords: Record<string, { collectionPatterns: string[]; keywords: string[] }> = {
      education: {
        collectionPatterns: ["education"],
        keywords: ["education", "study", "university", "student", "learn", "course", "tutor", "interview", "case", "mba", "consulting", "mckinsey", "bain", "bcg", "college", "academic", "exam", "school", "prep"],
      },
      tech: {
        collectionPatterns: ["tech"],
        keywords: ["tech", "code", "software", "developer", "programming", "app", "ai", "saas", "productivity", "automation", "platform", "tool", "api"],
      },
      fitness_women: {
        collectionPatterns: ["fitness_women", "fitness women"],
        keywords: ["fitness women", "pilates", "yoga", "wellness", "women workout"],
      },
      fitness_gym: {
        collectionPatterns: ["fitness_gym", "fitness gym"],
        keywords: ["gym", "workout", "muscle", "bodybuilding", "protein", "crossfit", "weightlifting"],
      },
      fitness: {
        collectionPatterns: ["fitness"],
        keywords: ["fitness", "exercise", "health", "active", "sport", "athletic"],
      },
      skincare: {
        collectionPatterns: ["skincare"],
        keywords: ["skincare", "beauty", "skin", "cosmetic", "derma", "glow", "serum", "cream"],
      },
      luxury: {
        collectionPatterns: ["luxury"],
        keywords: ["luxury", "premium", "high-end", "designer", "wealthy", "rich", "exclusive"],
      },
      business: {
        collectionPatterns: ["business"],
        keywords: ["business", "startup", "entrepreneur", "company", "agency", "freelance", "founder", "b2b"],
      },
      coaching: {
        collectionPatterns: ["coaching"],
        keywords: ["coach", "mentor", "self-help", "personal development", "therapy", "mindset", "growth"],
      },
      ecommerce: {
        collectionPatterns: ["ecommerce"],
        keywords: ["ecommerce", "shop", "store", "dropship", "amazon", "shopify", "retail", "cart"],
      },
      lifestyle: {
        collectionPatterns: ["lifestyle"],
        keywords: ["lifestyle", "morning", "routine", "aesthetic", "daily", "habit"],
      },
      food: {
        collectionPatterns: ["food"],
        keywords: ["food", "restaurant", "recipe", "cooking", "chef", "meal", "nutrition", "diet"],
      },
      travel: {
        collectionPatterns: ["travel"],
        keywords: ["travel", "hotel", "flight", "vacation", "trip", "adventure", "explore", "tourism"],
      },
      finance: {
        collectionPatterns: ["finance"],
        keywords: ["finance", "investing", "money", "budget", "trading", "crypto", "wealth", "savings"],
      },
    };

    // Score each collection against the product
    let bestScore = -1;
    let bestCollection = collections[0];

    for (const coll of collections) {
      const collName = coll.name.toLowerCase();

      for (const [, config] of Object.entries(nicheKeywords)) {
        // Check if this collection matches this niche
        const matchesCollection = config.collectionPatterns.some((p) => collName.includes(p));
        if (!matchesCollection) continue;

        // Score: how many keywords match the product text
        const score = productText
          ? config.keywords.filter((kw) => productText.includes(kw)).length
          : 0;

        if (score > bestScore) {
          bestScore = score;
          bestCollection = coll;
        }
      }
    }

    // Only auto-select if we found a real match (score > 0), otherwise pick education or first
    if (bestScore <= 0 && productText) {
      // Fallback: find "Education" collection as safe default for unknown niches
      const eduColl = collections.find((c) => c.name.toLowerCase().includes("education"));
      if (eduColl) bestCollection = eduColl;
    }

    store.setSelectedCollectionId(bestCollection.id);
  }, [products, collections, store.productId, store.selectedCollectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign images when collection data loads and slides have no images
  useEffect(() => {
    const images = collectionData?.images ?? [];
    if (images.length === 0) return;
    if (store.slides.length === 0) return;

    const emptySlides = store.slides
      .map((s, i) => ({ slide: s, index: i }))
      .filter(({ slide }) => !slide.imageUrl);
    if (emptySlides.length === 0) return;

    // Pick unique images not already used
    const usedIds = new Set(store.slides.map((s) => s.imageId).filter(Boolean));
    const available = images.filter((img) => !usedIds.has(img.id) && img.url);

    // Fisher-Yates shuffle
    const pool = [...(available.length >= emptySlides.length ? available : images.filter((img) => img.url))];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    emptySlides.forEach(({ index }, i) => {
      const img = pool[i % pool.length];
      if (img?.url) {
        store.updateSlideImage(index, img.id, img.url);
      }
    });
  }, [collectionData, store.slides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign random images from collection to slides that don't have images
  const autoAssignImages = () => {
    const images = collectionData?.images ?? [];
    if (images.length === 0) return;

    // Shuffle images
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    let imgIdx = 0;

    store.slides.forEach((slide, slideIdx) => {
      if (!slide.imageUrl && imgIdx < shuffled.length) {
        const img = shuffled[imgIdx];
        if (img.url) {
          store.updateSlideImage(slideIdx, img.id, img.url);
          imgIdx++;
        }
      }
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-4">
        {/* Product */}
        <div className="space-y-2">
          <Select
            value={store.productId ?? "none"}
            onValueChange={(v) => store.setProductId(v === "none" ? null : v)}
          >
            <SelectTrigger className="w-full text-xs h-8">
              <SelectValue placeholder="Link a product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No product</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Hook + Generate */}
        <HookSelector />
        <GenerateButton />

        <Separator />

        {/* Slide Text Editor */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Slide {store.selectedSlideIndex + 1} Text
            {store.slides[store.selectedSlideIndex] && (
              <span className="ml-1.5 text-muted-foreground font-normal">
                ({store.slides[store.selectedSlideIndex].type})
              </span>
            )}
          </Label>
          <SlideTextEditor />
        </div>

        <Separator />

        {/* Style */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Style</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["tiktok", "instagram", "inter"] as const).map((style) => (
              <button
                key={style}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                  store.settings.captionStyle === style
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                )}
                onClick={() => store.setSettings({ captionStyle: style })}
              >
                {style}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">White badge on titles</span>
            <button
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                store.settings.showPill ? "bg-primary" : "bg-muted",
              )}
              onClick={() => store.setSettings({ showPill: !store.settings.showPill })}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  store.settings.showPill ? "translate-x-4.5" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Overlay</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.round(store.settings.overlay.opacity * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[Math.round(store.settings.overlay.opacity * 100)]}
                onValueChange={([v]) => store.setOverlayOpacity(v / 100)}
              />
            </div>
            <input
              type="color"
              value={store.settings.overlay.color}
              onChange={(e) =>
                store.setSettings({
                  overlay: { ...store.settings.overlay, color: e.target.value },
                })
              }
              className="h-7 w-7 cursor-pointer rounded border border-border bg-transparent shrink-0"
            />
          </div>
        </div>

        <Separator />

        {/* Collection + auto-assign */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Image Collection</Label>
            {store.selectedCollectionId && (collectionData?.images?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px] gap-1"
                onClick={autoAssignImages}
              >
                <Shuffle className="size-3" />
                Auto-fill images
              </Button>
            )}
          </div>
          <Select
            value={store.selectedCollectionId ?? "none"}
            onValueChange={(v) =>
              store.setSelectedCollectionId(v === "none" ? null : v)
            }
          >
            <SelectTrigger className="w-full text-xs h-8">
              <SelectValue placeholder="Select a collection" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No collection</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.image_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs shrink-0">Duration</Label>
          <Input
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={store.settings.slideDuration}
            onChange={(e) =>
              store.setSettings({ slideDuration: Number(e.target.value) })
            }
            className="w-16 text-xs h-8"
          />
          <span className="text-xs text-muted-foreground">
            = {(store.settings.slideDuration * store.slides.length).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}
