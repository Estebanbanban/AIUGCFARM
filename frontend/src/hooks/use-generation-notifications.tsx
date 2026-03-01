"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useWatchedGenerationsStore } from "@/stores/watched-generations";
import { useGenerationStatus } from "@/hooks/use-generations";
import { GenerationCompleteNotification } from "@/components/notifications/GenerationCompleteNotification";

export function useGenerationNotifications() {
  const generations = useWatchedGenerationsStore((s) => s.generations);
  const cleanupOld = useWatchedGenerationsStore((s) => s.cleanupOld);
  const markNotified = useWatchedGenerationsStore((s) => s.markNotified);
  const pathname = usePathname();

  useEffect(() => {
    cleanupOld();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = generations.find((g) => !g.notified) ?? null;

  const { data: gen } = useGenerationStatus(active?.id ?? null);
  const status = gen?.status;

  useEffect(() => {
    if (!active) return;
    if (status === "completed" && !pathname.includes(`/generate/${active.id}`)) {
      toast.custom(
        (t) => (
          <GenerationCompleteNotification
            toastId={t}
            generationId={active.id}
            productName={active.productName}
          />
        ),
        { duration: Infinity, position: "top-right" }
      );
      markNotified(active.id);
    } else if (status === "failed") {
      markNotified(active.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
}
