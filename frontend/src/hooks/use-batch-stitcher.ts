"use client";

import { useCallback, useState } from "react";
import { zip } from "fflate";
import { stitchToBlob } from "@/hooks/use-video-stitcher";

export type BatchStitchStatus =
  | "idle"
  | "stitching"
  | "zipping"
  | "done"
  | "error";

export interface BatchCombo {
  hookUrl: string;
  bodyUrl: string;
  ctaUrl: string;
  /** e.g. "hook1-body2-cta3" */
  label: string;
}

export function useBatchStitcher() {
  const [status, setStatus] = useState<BatchStitchStatus>("idle");
  const [progress, setProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [currentLabel, setCurrentLabel] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const batchStitch = useCallback(
    async (combos: BatchCombo[], generationId: string) => {
      if (combos.length === 0) return;

      setStatus("stitching");
      setProgress({ current: 0, total: combos.length });
      setCurrentLabel("");
      setError(null);

      try {
        const files: Record<string, Uint8Array> = {};

        for (let i = 0; i < combos.length; i++) {
          const combo = combos[i];
          setCurrentLabel(combo.label);
          setProgress({ current: i, total: combos.length });

          const blob = await stitchToBlob(combo.hookUrl, combo.bodyUrl, combo.ctaUrl);
          const buffer = await blob.arrayBuffer();
          files[`combo_${combo.label}.mp4`] = new Uint8Array(buffer);

          setProgress({ current: i + 1, total: combos.length });
        }

        setStatus("zipping");
        setCurrentLabel("");

        await new Promise<void>((resolve, reject) => {
          zip(files, { level: 0 }, (err, data) => {
            if (err) { reject(err); return; }
            const zipBlob = new Blob([data.buffer as ArrayBuffer], { type: "application/zip" });
            const url = URL.createObjectURL(zipBlob);
            const date = new Date().toISOString().slice(0, 10);
            const a = document.createElement("a");
            a.href = url;
            a.download = `cinerades-${generationId.slice(0, 8)}-batch-${date}.zip`;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            resolve();
          });
        });

        setStatus("done");
        setTimeout(() => setStatus("idle"), 4000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Batch export failed";
        setError(msg);
        setStatus("error");
      }
    },
    [],
  );

  const isActive = status === "stitching" || status === "zipping";

  return { batchStitch, status, progress, currentLabel, error, isActive };
}
