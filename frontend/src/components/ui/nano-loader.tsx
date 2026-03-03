"use client";

import React from "react";
import { CheckCircle2, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NanoBananaLoaderProps {
  title: string;
  subtitle?: string;
  steps: { label: string; icon?: React.ReactNode }[];
  currentStep: number;
  progress: number;
  className?: string;
}

function HudSpinner() {
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* Outer ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2 border-amber-500/30",
          "border-t-amber-500 animate-spin [animation-duration:3s]"
        )}
      />
      {/* Inner ring */}
      <div
        className={cn(
          "absolute inset-3 rounded-full border-2 border-amber-500/20",
          "border-b-amber-500 animate-spin [animation-duration:2s] [animation-direction:reverse]"
        )}
      />
      {/* Center icon */}
      <Sparkles
        className="w-8 h-8 text-amber-500 animate-pulse drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]"
      />
    </div>
  );
}

export function NanoBananaLoader({
  title,
  subtitle,
  steps,
  currentStep,
  progress,
  className,
}: NanoBananaLoaderProps) {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div
      className={cn(
        "w-full flex flex-col items-center justify-center gap-8 py-8",
        className
      )}
    >
      {/* Title */}
      {title && (
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          {subtitle && (
            <p className="text-sm text-zinc-500">{subtitle}</p>
          )}
        </div>
      )}

      {/* HUD container */}
      <div className="w-full max-w-md rounded-xl border border-zinc-800/50 bg-[#161616] p-6 space-y-6">
        {/* Live preview label */}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-700">
          Live Preview
        </span>

        {/* Spinner + progress section */}
        <div className="flex flex-col items-center gap-4">
          <HudSpinner />

          {/* Progress label + percentage */}
          <div className="w-full flex items-center justify-between font-mono text-xs">
            <span className="text-amber-500 uppercase tracking-wider">
              Traitement IA
            </span>
            <span className="text-amber-500 tabular-nums">
              {Math.round(clampedProgress)}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-700"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>

        {/* Steps list */}
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const isDone = idx < currentStep;
            const isActive = idx === currentStep;
            const isPending = idx > currentStep;

            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-3 py-1.5 px-2 rounded-md transition-all duration-500",
                  isPending && "opacity-20"
                )}
              >
                {/* Step icon */}
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-amber-500 flex-shrink-0" />
                ) : isActive ? (
                  <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    {step.icon ?? (
                      <Zap className="w-3 h-3 text-[#0d0d0d]" />
                    )}
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-zinc-700 flex items-center justify-center flex-shrink-0">
                    {step.icon ?? (
                      <Zap className="w-3 h-3 text-zinc-700" />
                    )}
                  </div>
                )}

                {/* Step label */}
                <span
                  className={cn(
                    "text-sm transition-all duration-500",
                    isDone && "text-zinc-200",
                    isActive && "text-zinc-200 font-bold",
                    isPending && "text-zinc-700"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      <div className="w-full max-w-md flex items-center justify-between px-2 text-[10px] font-mono uppercase tracking-widest text-zinc-700">
        <span>N-Banana</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </span>
      </div>
    </div>
  );
}
