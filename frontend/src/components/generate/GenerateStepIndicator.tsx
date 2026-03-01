"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
}

interface GenerateStepIndicatorProps {
  currentStep: number; // 1-based
  steps: Step[];
}

export function GenerateStepIndicator({ currentStep, steps }: GenerateStepIndicatorProps) {
  return (
    <div className="flex w-full items-start">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <div key={step.label} className="flex flex-1 items-start">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  isCompleted && "border border-primary bg-primary/10 text-primary",
                  isActive && "bg-primary text-primary-foreground",
                  !isCompleted && !isActive && "border border-border bg-background text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  isCompleted && "font-medium text-primary",
                  isActive && "font-semibold text-foreground",
                  !isCompleted && !isActive && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {index < steps.length - 1 && (
              <div className="mt-4 flex flex-1 items-center px-2">
                <div
                  className={cn(
                    "h-px w-full border-t border-dashed",
                    isCompleted ? "border-primary/40" : "border-border",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
