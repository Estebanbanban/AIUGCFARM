"use client";

import { useState, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { SlidePreview } from "./SlidePreview";
import { toast } from "sonner";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";

/** Wait for all images inside an element to finish loading */
async function waitForImages(el: HTMLElement, timeoutMs = 5000): Promise<void> {
  const images = el.querySelectorAll("img");
  if (images.length === 0) return;

  await Promise.race([
    Promise.all(
      Array.from(images).map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve(); // Don't block on broken images
              }),
      ),
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

export function ExportButton() {
  const store = useSlideshowEditorStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (store.slides.length === 0) {
      toast.error("No slides to export");
      return;
    }

    setExporting(true);
    toast.info("Rendering slides...");

    try {
      const zip = new JSZip();

      for (let i = 0; i < store.slides.length; i++) {
        const slide = store.slides[i];
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "0";
        container.style.width = "1080px";
        container.style.height = "1920px";
        container.style.overflow = "hidden";
        document.body.appendChild(container);

        let root: ReturnType<typeof createRoot> | null = null;

        try {
          root = createRoot(container);
          await new Promise<void>((resolve) => {
            root!.render(
              <SlidePreview
                slide={slide}
                settings={store.settings}
                scale={4}
                captionStyle={store.settings.captionStyle}
                showPill={store.settings.showPill}
              />,
            );
            // Give React a frame to paint
            requestAnimationFrame(() => setTimeout(resolve, 100));
          });

          // Wait for images to load (up to 5s)
          await waitForImages(container);

          const slideEl = container.firstElementChild as HTMLElement;
          if (slideEl) {
            const dataUrl = await toPng(slideEl, {
              width: 1080,
              height: 1920,
              pixelRatio: 1,
            });

            // Convert data URL to blob without fetch (avoids CSP connect-src restriction)
            const base64 = dataUrl.split(",")[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) {
              bytes[j] = binary.charCodeAt(j);
            }
            const blob = new Blob([bytes], { type: "image/png" });

            // Unique filename: slide_0_hook.png, slide_1_body.png, etc.
            zip.file(`slide_${i}_${slide.type}.png`, blob);
          }
        } finally {
          // Always clean up, even if rendering/capture fails
          if (root) root.unmount();
          if (container.parentNode) document.body.removeChild(container);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const filename = `${store.name || "slideshow"}-slides.zip`.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
      saveAs(zipBlob, filename);

      toast.success(`Exported ${store.slides.length} slides`);
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export slides");
    } finally {
      setExporting(false);
    }
  }, [store.slides, store.settings, store.name]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || store.slides.length === 0}
    >
      {exporting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
      {exporting ? "Exporting..." : "Export ZIP"}
    </Button>
  );
}
