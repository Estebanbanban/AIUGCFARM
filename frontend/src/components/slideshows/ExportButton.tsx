"use client";

import { useState, useRef, useCallback } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSlideshowEditorStore } from "@/stores/slideshow-editor";
import { SlidePreview } from "./SlidePreview";
import { toast } from "sonner";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import JSZip from "jszip";
import { saveAs } from "file-saver";

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

        // Create a hidden container for rendering at full resolution
        const container = document.createElement("div");
        container.style.position = "fixed";
        container.style.left = "-9999px";
        container.style.top = "0";
        container.style.width = "1080px";
        container.style.height = "1920px";
        container.style.overflow = "hidden";
        document.body.appendChild(container);

        // Render the slide at full scale (1080x1920)
        const root = createRoot(container);
        await new Promise<void>((resolve) => {
          root.render(
            <SlidePreview
              slide={slide}
              settings={store.settings}
              scale={4} // 270 * 4 = 1080px
              captionStyle={store.settings.captionStyle}
              showPill={store.settings.showPill}
            />,
          );
          // Wait for render + image load
          setTimeout(resolve, 500);
        });

        // Capture as PNG
        const slideEl = container.firstElementChild as HTMLElement;
        if (slideEl) {
          const dataUrl = await toPng(slideEl, {
            width: 1080,
            height: 1920,
            pixelRatio: 1,
          });

          // Convert data URL to blob
          const response = await fetch(dataUrl);
          const blob = await response.blob();

          const label =
            slide.type === "hook" ? "hook" :
            slide.type === "cta" ? "cta" :
            `slide_${i}`;
          zip.file(`${label}.png`, blob);
        }

        root.unmount();
        document.body.removeChild(container);
      }

      // Generate and download the zip
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
