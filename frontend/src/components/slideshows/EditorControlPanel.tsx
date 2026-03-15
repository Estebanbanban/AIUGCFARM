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

  // Auto-select product if user only has one
  useEffect(() => {
    if (products.length >= 1 && !store.productId) {
      store.setProductId(products[0].id);
    }
  }, [products, store.productId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select best collection based on product name, or first available
  useEffect(() => {
    if (collections.length === 0) return;
    if (store.selectedCollectionId) return; // already picked

    // Try to match product to a collection by keyword
    const selectedProduct = products.find((p) => p.id === store.productId);
    const productText = (selectedProduct?.name ?? "").toLowerCase() + " " + (selectedProduct?.description ?? "").toLowerCase();

    const nicheKeywords: Record<string, string[]> = {
      education: ["education", "study", "university", "student", "learn", "course", "tutor", "interview", "case", "mba", "consulting", "mckinsey", "bain", "bcg", "college", "academic"],
      tech: ["tech", "code", "software", "developer", "programming", "app", "ai", "saas", "productivity", "automation"],
      fitness_women: ["fitness women", "pilates", "yoga women", "running women", "wellness women"],
      fitness_gym: ["fitness", "gym", "workout", "muscle", "bodybuilding", "protein", "crossfit"],
      skincare: ["skincare", "beauty", "skin", "cosmetic", "routine", "derma", "glow", "serum"],
      luxury: ["luxury", "premium", "high-end", "designer", "wealthy", "rich", "exclusive"],
      business: ["business", "startup", "entrepreneur", "saas", "company", "agency", "freelance", "founder"],
      coaching: ["coach", "mentor", "self-help", "personal development", "therapy", "mindset", "growth"],
      ecommerce: ["ecommerce", "shop", "store", "product", "dropship", "amazon", "shopify", "retail"],
      lifestyle: ["lifestyle", "travel", "morning", "routine", "aesthetic", "daily"],
      food: ["food", "restaurant", "recipe", "cooking", "chef", "meal", "nutrition", "diet"],
      travel: ["travel", "hotel", "flight", "vacation", "trip", "adventure", "explore", "tourism"],
      finance: ["finance", "investing", "money", "budget", "trading", "crypto", "wealth", "savings"],
    };

    let bestScore = 0;
    let bestCollection = collections[0];
    if (productText.trim()) {
      for (const coll of collections) {
        const collName = coll.name.toLowerCase();
        for (const [niche, keywords] of Object.entries(nicheKeywords)) {
          if (!collName.includes(niche.replace("_", " ")) && !collName.includes(niche.split("_")[0])) continue;
          const score = keywords.filter((kw) => productText.includes(kw)).length;
          if (score > bestScore) {
            bestScore = score;
            bestCollection = coll;
          }
        }
      }
    }

    store.setSelectedCollectionId(bestCollection.id);
  }, [collections, store.productId, products, store.selectedCollectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-assign images when collection data loads and slides have no images
  useEffect(() => {
    const images = collectionData?.images ?? [];
    if (images.length === 0) return;

    const hasEmptySlides = store.slides.some((s) => !s.imageUrl);
    if (!hasEmptySlides) return;

    // Auto-fill empty slides with random images
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
  }, [collectionData]); // eslint-disable-line react-hooks/exhaustive-deps

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
