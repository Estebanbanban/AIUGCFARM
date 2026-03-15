"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { useProducts } from "@/hooks/use-products";
import { useCollections } from "@/hooks/use-collections";
import { HookSelector } from "./HookSelector";
import { SlideTextEditor } from "./SlideTextEditor";
import { GenerateButton } from "./GenerateButton";

export function EditorControlPanel() {
  const store = useSlideshowEditorStore();
  const { data: products = [] } = useProducts();
  const { data: collections = [] } = useCollections();

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-5">
        {/* Slideshow Name */}
        <div className="space-y-2">
          <Label htmlFor="slideshow-name">Name</Label>
          <Input
            id="slideshow-name"
            value={store.name}
            onChange={(e) => store.setName(e.target.value)}
            placeholder="My Slideshow"
            className="text-sm"
          />
        </div>

        <Separator />

        {/* Product Selector */}
        <div className="space-y-2">
          <Label>Product</Label>
          <Select
            value={store.productId ?? "none"}
            onValueChange={(v) => {
              const id = v === "none" ? null : v;
              store.loadSlideshow(
                store.slideshowId!,
                store.name,
                store.settings,
                store.slides,
                store.hookText,
                id,
                store.status,
              );
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a product" />
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

        {/* Hook Selector */}
        <HookSelector />

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

        {/* Generate Body Copy */}
        <GenerateButton />

        <Separator />

        {/* Overlay Controls */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Overlay</Label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Opacity</span>
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

          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={store.settings.overlay.color}
                onChange={(e) =>
                  store.setSettings({
                    overlay: { ...store.settings.overlay, color: e.target.value },
                  })
                }
                className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
              />
              <span className="text-xs font-mono text-muted-foreground">
                {store.settings.overlay.color}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Caption Style */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Caption Style</Label>
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

          {/* Show Pill Toggle */}
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
        </div>

        <Separator />

        {/* Duration Control */}
        <div className="space-y-2">
          <Label>Slide Duration (seconds)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={store.settings.slideDuration}
              onChange={(e) =>
                store.setSettings({ slideDuration: Number(e.target.value) })
              }
              className="w-24 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              Total: {(store.settings.slideDuration * store.slides.length).toFixed(1)}s
            </span>
          </div>
        </div>

        <Separator />

        {/* Collection Selector */}
        <div className="space-y-2">
          <Label>Image Collection</Label>
          <Select
            value={store.selectedCollectionId ?? "none"}
            onValueChange={(v) =>
              store.setSelectedCollectionId(v === "none" ? null : v)
            }
          >
            <SelectTrigger className="w-full">
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

        {/* Aspect Ratio (read-only) */}
        <div className="space-y-2">
          <Label>Aspect Ratio</Label>
          <div className="flex h-9 items-center rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground">
            {store.settings.aspectRatio}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
