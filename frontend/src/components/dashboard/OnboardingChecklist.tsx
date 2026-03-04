"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Package, User, Film } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const SKIP_KEY = "onboarding-skipped";

interface OnboardingChecklistProps {
  hasProduct: boolean;
  hasPersonaWithImage: boolean;
  hasCompletedGeneration: boolean;
}

const steps = [
  {
    key: "product" as const,
    title: "Import a product",
    description: "Add at least one product from your store to get started.",
    href: "/products",
    icon: Package,
    propKey: "hasProduct" as const,
  },
  {
    key: "persona" as const,
    title: "Create a persona",
    description: "Build your AI creator with a unique look and voice.",
    href: "/personas/new",
    icon: User,
    propKey: "hasPersonaWithImage" as const,
  },
  {
    key: "generation" as const,
    title: "Generate your first video",
    description: "Produce your first AI-powered UGC video ad.",
    href: "/generate",
    icon: Film,
    propKey: "hasCompletedGeneration" as const,
  },
];

export function OnboardingChecklist({
  hasProduct,
  hasPersonaWithImage,
  hasCompletedGeneration,
}: OnboardingChecklistProps) {
  const props = { hasProduct, hasPersonaWithImage, hasCompletedGeneration };
  const completedCount = steps.filter((s) => props[s.propKey]).length;
  const [tutorialSkipped, setTutorialSkipped] = useState(false);

  useEffect(() => {
    setTutorialSkipped(localStorage.getItem(SKIP_KEY) === "true");
  }, []);

  function handleResumeTutorial() {
    localStorage.removeItem(SKIP_KEY);
    setTutorialSkipped(false);
    window.dispatchEvent(new CustomEvent("onboarding:resume"));
  }

  if (completedCount === steps.length) return null;

  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Get Started</CardTitle>
          <span className="text-xs font-medium text-muted-foreground">
            {completedCount}/{steps.length} steps completed
          </span>
        </div>
        <Progress
          value={progressPercent}
          className="mt-2 h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-emerald-500"
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {tutorialSkipped && (
          <button
            onClick={handleResumeTutorial}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Resume guided tutorial
          </button>
        )}
        {steps.map((step, index) => {
          const done = props[step.propKey];
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-start gap-4 rounded-lg border border-border p-4 transition-colors",
                done
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-background"
              )}
            >
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
                {done ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {!done && (
                <Button asChild size="sm" variant="default" className="shrink-0">
                  <Link href={step.href}>
                    Start
                  </Link>
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
