"use client";

import { useCallback, useState } from "react";
import { zip } from "fflate";

export type ZipStatus = "idle" | "fetching" | "zipping" | "done" | "error";

export interface ZipEntry {
  /** Filename inside the ZIP (may include subdirs: "hooks/hook_1.mp4") */
  name: string;
  /** Remote URL or blob: URL to fetch */
  url: string;
  /** Pre-fetched blob - skip network fetch if provided */
  blob?: Blob;
}

export function useZipDownload() {
  const [status, setStatus] = useState<ZipStatus>("idle");
  const [fetchedCount, setFetchedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const downloadZip = useCallback(
    async (entries: ZipEntry[], filename: string) => {
      setStatus("fetching");
      setFetchedCount(0);
      setTotalCount(entries.length);
      setError(null);

      try {
        // Fetch all files (sequentially to avoid memory spikes)
        const files: Record<string, Uint8Array> = {};
        for (const entry of entries) {
          let buffer: ArrayBuffer;
          if (entry.blob) {
            buffer = await entry.blob.arrayBuffer();
          } else {
            const res = await fetch(entry.url);
            if (!res.ok) throw new Error(`Failed to fetch ${entry.name}: ${res.status}`);
            buffer = await res.arrayBuffer();
          }
          files[entry.name] = new Uint8Array(buffer);
          setFetchedCount((n) => n + 1);
        }

        setStatus("zipping");

        // Build ZIP asynchronously
        await new Promise<void>((resolve, reject) => {
          zip(files, { level: 0 }, (err, data) => {
            if (err) { reject(err); return; }
            const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/zip" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Revoke after brief delay
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
            resolve();
          });
        });

        setStatus("done");
        // Reset to idle after a moment so button can be used again
        setTimeout(() => setStatus("idle"), 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "ZIP export failed";
        setError(msg);
        setStatus("error");
      }
    },
    [],
  );

  const isActive = status === "fetching" || status === "zipping";

  return { downloadZip, status, fetchedCount, totalCount, error, isActive };
}
