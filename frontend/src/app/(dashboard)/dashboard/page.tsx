"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  CreditCard,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
  Plus,
  Play,
  Pencil,
  Loader,
  ChevronRight,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import {
  CREDITS_PER_SINGLE,
  CREDITS_PER_BATCH,
  CREDITS_PER_SINGLE_HD,
  CREDITS_PER_BATCH_HD,
} from "@/lib/stripe";
import { useCredits } from "@/hooks/use-credits";
import { useProfile } from "@/hooks/use-profile";
import {
  useGenerations,
  type GenerationWithRelations,
} from "@/hooks/use-generations";
import { usePersonas } from "@/hooks/use-personas";
import { useProducts } from "@/hooks/use-products";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { CheckoutSuccessHandler } from "@/components/checkout/CheckoutSuccessHandler";

export default function DashboardPage() {
  const router = useRouter();
  const wizard = useGenerationWizardStore();
  const [firstName, setFirstName] = useState("there");

  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: _profile } = useProfile();
  const { data: generations, isLoading: generationsLoading } =
    useGenerations() as {
      data: GenerationWithRelations[] | undefined;
      isLoading: boolean;
    };
  const { data: personas } = usePersonas();
  const { data: products } = useProducts();

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;

  const recentGenerations = (generations ?? []).slice(0, 8);
  const draftGenerations = (generations ?? []).filter(
    (g) => g.status === "awaiting_approval",
  );
  const hasGenerations = recentGenerations.length > 0;
  const isOnboarding = !generationsLoading && !hasGenerations;
  const hasProducts = confirmedProducts.length > 0;
  const hasPersonas = (personas?.length ?? 0) > 0;

  function handleResumeDraft(gen: GenerationWithRelations) {
    if (!gen.script) {
      router.push("/generate");
      return;
    }
    const creditsToCharge =
      gen.video_quality === "hd"
        ? gen.mode === "single"
          ? CREDITS_PER_SINGLE_HD
          : CREDITS_PER_BATCH_HD
        : gen.mode === "single"
          ? CREDITS_PER_SINGLE
          : CREDITS_PER_BATCH;
    wizard.resumeFromGeneration({
      generationId: gen.id,
      script: gen.script,
      creditsToCharge,
      productId: gen.product_id,
      personaId: gen.persona_id,
      mode: gen.mode,
      quality: gen.video_quality as "standard" | "hd",
    });
    router.push("/generate");
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.full_name) {
        setFirstName(user.user_metadata.full_name.split(" ")[0]);
      } else if (user?.email) {
        setFirstName(user.email.split("@")[0]);
      }
    });
  }, []);

  const isRendering = (status: string) =>
    !["completed", "failed"].includes(status);

  return (
    <>
      <Suspense>
        <CheckoutSuccessHandler />
      </Suspense>

      <div className="space-y-10 pb-16">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isOnboarding ? "Get started" : `Welcome back, ${firstName}`}
            </h1>
            {isOnboarding ? (
              <p className="mt-1 text-slate-500">
                Complete these steps to generate your first video ad.
              </p>
            ) : draftGenerations.length > 0 ? (
              <p className="mt-1 text-slate-500">
                You have {draftGenerations.length} script
                {draftGenerations.length !== 1 ? "s" : ""} waiting to be generated.
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {!creditsLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-sm">
                <CreditCard className="size-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-700">
                  {isUnlimitedCredits ? "Unlimited" : creditsRemaining}
                </span>
                <span className="text-xs text-slate-400">credits</span>
                {!isUnlimitedCredits && creditsRemaining === 0 && (
                  <Link
                    href="/pricing"
                    className="ml-1 text-xs font-semibold text-orange-500 hover:text-orange-600 transition-colors"
                  >
                    Top up →
                  </Link>
                )}
              </div>
            )}
            <Link
              href="/generate"
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow"
            >
              <Plus className="size-4" />
              New Generation
            </Link>
          </div>
        </div>

        {/* ── Onboarding checklist ────────────────────────────────────────── */}
        {isOnboarding && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {[
                {
                  step: 1,
                  label: "Import your product",
                  done: hasProducts,
                  active: !hasProducts,
                  href: "/products",
                  cta: "Import",
                },
                {
                  step: 2,
                  label: "Create an AI persona",
                  done: hasPersonas,
                  active: hasProducts && !hasPersonas,
                  href: "/personas/new",
                  cta: "Create",
                },
                {
                  step: 3,
                  label: "Generate your first video",
                  done: false,
                  active: hasProducts && hasPersonas,
                  href: "/generate",
                  cta: "Generate",
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className={cn(
                    "flex items-center justify-between px-6 py-4 transition-colors",
                    s.active ? "bg-orange-50/60" : "",
                  )}
                >
                  <div className="flex items-center gap-4">
                    {s.done ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                    ) : (
                      <Circle
                        className={cn(
                          "size-5 shrink-0",
                          s.active ? "text-orange-500" : "text-slate-300",
                        )}
                      />
                    )}
                    <span
                      className={cn(
                        "text-sm font-medium",
                        s.done
                          ? "text-slate-400 line-through"
                          : s.active
                            ? "text-slate-900"
                            : "text-slate-500",
                      )}
                    >
                      {s.step}. {s.label}
                    </span>
                  </div>
                  {!s.done && (
                    <Link
                      href={s.href}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                        s.active
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {s.cta}
                      {s.active && <ArrowRight className="size-3.5" />}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Continue Drafts ─────────────────────────────────────────────── */}
        {draftGenerations.length > 0 && (
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Continue Drafts
              </h2>
              <span className="text-xs text-slate-400">
                {draftGenerations.length} script
                {draftGenerations.length !== 1 ? "s" : ""} waiting
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {draftGenerations.map((gen) => (
                <div
                  key={gen.id}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-500 transition-colors group-hover:bg-orange-500 group-hover:text-white">
                      <Pencil className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="size-3" />
                        {formatDate(gen.created_at)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleResumeDraft(gen)}
                    className="group/btn mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-orange-500 hover:text-orange-500 sm:mt-0 sm:w-auto"
                  >
                    Continue Script
                    <ChevronRight className="size-4 text-slate-400 transition-all group-hover/btn:translate-x-0.5 group-hover/btn:text-orange-500" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Videos ───────────────────────────────────────────────── */}
        {(hasGenerations || generationsLoading) && (
          <section>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent Videos
              </h2>
              {hasGenerations && (
                <Link
                  href="/history"
                  className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                  View all
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>

            {generationsLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl bg-slate-100"
                    style={{ aspectRatio: "9/16" }}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {recentGenerations.map((gen) => {
                  const rendering = isRendering(gen.status);
                  const thumbSrc = gen.composite_image_url ?? null;

                  return (
                    <Link
                      key={gen.id}
                      href={`/generate/${gen.id}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
                    >
                      {/* Thumbnail — 9:16 */}
                      <div
                        className="relative w-full overflow-hidden bg-slate-100"
                        style={{ aspectRatio: "9/16" }}
                      >
                        {rendering ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
                            <div className="relative">
                              <div className="absolute inset-0 animate-pulse rounded-full bg-orange-500 opacity-20 blur-md" />
                              <Loader className="relative z-10 size-8 animate-spin text-orange-500" />
                            </div>
                            <p className="mt-4 text-xs font-semibold text-slate-700">
                              Rendering Video
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              ~3–5 minutes
                            </p>
                            <div className="mt-4 h-1 w-3/4 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full w-2/3 animate-pulse rounded-full bg-orange-500" />
                            </div>
                          </div>
                        ) : gen.status === "failed" ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-red-50">
                            <p className="text-xs font-semibold text-red-400">
                              Generation failed
                            </p>
                          </div>
                        ) : thumbSrc ? (
                          <>
                            <Image
                              src={thumbSrc}
                              alt={gen.products?.name ?? "Generation preview"}
                              fill
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                            />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <div className="flex size-12 items-center justify-center rounded-full border border-white/40 bg-white/20 backdrop-blur-md">
                                <Play className="size-5 fill-white text-white ml-0.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center">
                            <div className="flex size-12 items-center justify-center rounded-full border border-white/40 bg-white/20 backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <Play className="size-5 fill-white text-white ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="border-t border-slate-100 p-3">
                        <p className="line-clamp-1 text-sm font-semibold text-slate-900">
                          {gen.products?.name ?? `Generation ${gen.id.slice(0, 8)}`}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {formatDate(gen.created_at)}
                          </span>
                          {rendering && (
                            <span className="flex items-center gap-1.5 rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-orange-600">
                              <span className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-orange-500 opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-orange-500" />
                              </span>
                              Live
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
