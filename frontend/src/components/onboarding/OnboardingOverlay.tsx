"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { usePersonas } from "@/hooks/use-personas";
import { useGenerations } from "@/hooks/use-generations";
import {
  Package,
  User,
  Film,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const SKIP_KEY = "onboarding-skipped";

const steps = [
  {
    key: "product",
    title: "Import your brand",
    description:
      "Add at least one product from your store URL to get started.",
    href: "/products",
    icon: Package,
    doneKey: "hasProduct" as const,
  },
  {
    key: "persona",
    title: "Create a persona",
    description: "Build your AI creator — choose a look, voice, and style.",
    href: "/personas/new",
    icon: User,
    doneKey: "hasPersonaWithImage" as const,
  },
  {
    key: "generation",
    title: "Generate your first video",
    description: "Produce your first AI-powered UGC ad in minutes.",
    href: "/generate",
    icon: Film,
    doneKey: "hasCompletedGeneration" as const,
  },
];

export function OnboardingOverlay() {
  const [hasProduct, setHasProduct] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [skipped, setSkipped] = useState(false);
  const router = useRouter();

  const { data: personas } = usePersonas();
  const { data: generations } = useGenerations();

  const hasPersonaWithImage = (personas ?? []).some(
    (p) => p.selected_image_url != null,
  );
  const hasCompletedGeneration = (generations ?? []).some(
    (g) => g.status === "completed",
  );

  const doneMap = { hasProduct, hasPersonaWithImage, hasCompletedGeneration };
  const completedCount = steps.filter((s) => doneMap[s.doneKey]).length;
  const allDone = completedCount === steps.length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSkipped(localStorage.getItem(SKIP_KEY) === "true");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("products")
      .select("id")
      .eq("status", "confirmed")
      .limit(1)
      .then(({ data }: { data: { id: string }[] | null }) => {
        setHasProduct((data ?? []).length > 0);
        setIsLoading(false);
      });
  }, []);

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(SKIP_KEY, "true");
    }
    setSkipped(true);
  };

  const show = !isLoading && !allDone && !skipped;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop — blurs and dims everything behind the modal */}
          <motion.div
            key="onboarding-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal card */}
          <motion.div
            key="onboarding-modal"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              {/* Header */}
              <div className="border-b border-border p-6">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="size-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  Welcome! Let&apos;s get you set up.
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Complete these 3 quick steps to launch your first UGC video
                  ad.
                </p>

                {/* Progress bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {completedCount} of {steps.length} steps done
                    </span>
                    <span className="font-medium text-foreground">
                      {progressPercent}%
                    </span>
                  </div>
                  <Progress
                    value={progressPercent}
                    className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
                  />
                </div>
              </div>

              {/* Steps list */}
              <div className="flex flex-col gap-2.5 p-6">
                {steps.map((step, index) => {
                  const done = doneMap[step.doneKey];
                  const prevDone =
                    index === 0 || doneMap[steps[index - 1].doneKey];
                  const isActive = !done && prevDone;
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.key}
                      className={cn(
                        "flex items-start gap-4 rounded-xl border p-4 transition-all duration-200",
                        done &&
                          "border-emerald-500/20 bg-emerald-500/5 opacity-60",
                        isActive &&
                          "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20",
                        !done &&
                          !isActive &&
                          "border-border bg-background opacity-40",
                      )}
                    >
                      {/* Icon bubble */}
                      <div
                        className={cn(
                          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                          done && "bg-emerald-500/15",
                          isActive && "bg-primary/15",
                          !done && !isActive && "bg-muted",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="size-5 text-emerald-500" />
                        ) : (
                          <Icon
                            className={cn(
                              "size-5",
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          />
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex flex-1 flex-col gap-0.5">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            done && "text-muted-foreground line-through",
                            isActive && "text-foreground",
                            !done && !isActive && "text-muted-foreground",
                          )}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {step.description}
                        </p>
                      </div>

                      {/* CTA — only on the active step */}
                      {isActive && (
                        <Button
                          size="sm"
                          className="shrink-0 gap-1.5"
                          onClick={() => router.push(step.href)}
                        >
                          Start
                          <ArrowRight className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer — subtle skip */}
              <div className="border-t border-border px-6 py-4">
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
