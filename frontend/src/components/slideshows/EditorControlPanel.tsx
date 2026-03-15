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
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-4">
        {/* Name + Product in a compact row */}
        <div className="space-y-2">
          <Input
            value={store.name}
            onChange={(e) => store.setName(e.target.value)}
            placeholder="Slideshow name"
            className="text-sm font-medium"
          />
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

        {/* Hook Selector + Generate in one section */}
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

        {/* Style section — collapsed */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Style</Label>

          {/* Caption Style */}
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

          {/* Pill toggle */}
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

          {/* Overlay */}
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

        {/* Collection + Duration compact */}
        <div className="space-y-2">
          <Label className="text-xs">Image Collection</Label>
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
