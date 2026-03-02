"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { usePersonas } from "@/hooks/use-personas";
import { useGenerations } from "@/hooks/use-generations";
import { useProducts, useScrapeProduct } from "@/hooks/use-products";
import { PersonaBuilderInline } from "@/components/personas/PersonaBuilderInline";
import { ScrapeResults } from "@/components/products/ScrapeResults";
import { ManualUploadForm } from "@/components/products/ManualUploadForm";
import {
  Package,
  User,
  Film,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  ArrowLeft,
  LinkIcon,
  Upload,
  Loader2,
  X,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import type { Product, BrandSummary, Persona } from "@/types/database";
import type { ScrapeResponseData } from "@/types/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const SKIP_KEY = "onboarding-skipped";

type WizardView =
  | "checklist"
  | "step-brand"
  | "step-persona"
  | "step-video"
  | "banner";

const STEPS = [
  {
    key: "product" as const,
    label: "Brand",
    title: "Import your brand",
    description: "Add at least one product from your store. (~2 min)",
    icon: Package,
    doneKey: "hasProduct" as const,
    view: "step-brand" as WizardView,
  },
  {
    key: "persona" as const,
    label: "Persona",
    title: "Create your AI creator",
    description: "Create your AI spokesperson — customize look, style & vibe. They'll star in every video you make. (~5 min)",
    icon: User,
    doneKey: "hasPersonaWithImage" as const,
    view: "step-persona" as WizardView,
  },
  {
    key: "generation" as const,
    label: "Video",
    title: "Generate your first video",
    description: "Launch your first AI-powered UGC ad. (~1 min to start)",
    icon: Film,
    doneKey: "hasCompletedGeneration" as const,
    view: "step-video" as WizardView,
  },
] as const;

// ─── Main export ──────────────────────────────────────────────────────────────

export function OnboardingOverlay() {
  const router = useRouter();
  const [view, setView] = useState<WizardView>("checklist");
  const [skipped, setSkipped] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: generations, isLoading: generationsLoading } = useGenerations();

  const hasProduct = (products?.length ?? 0) > 0;
  const hasPersonaWithImage = (personas ?? []).some(
    (p) => p.selected_image_url != null,
  );
  const hasCompletedGeneration = (generations ?? []).some(
    (g) => g.status === "completed",
  );

  const doneMap = { hasProduct, hasPersonaWithImage, hasCompletedGeneration };
  const completedCount = STEPS.filter((s) => doneMap[s.doneKey]).length;
  const allDone = completedCount === STEPS.length;
  const isLoading = productsLoading || personasLoading || generationsLoading;

  // If the user has an active wizard session (composites or script already generated),
  // suppress the full-modal overlay so we don't interrupt mid-flow or cause regeneration.
  // They can still see the banner mode if they navigated from the overlay previously.
  const [hasActiveWizardSession, setHasActiveWizardSession] = useState(false);
  useEffect(() => {
    const { compositeImagePath, pendingScript, pendingGenerationId } = useGenerationWizardStore.getState();
    setHasActiveWizardSession(!!(compositeImagePath || pendingScript || pendingGenerationId));
  }, []);

  // Read skip state from localStorage (client-only, avoids SSR mismatch)
  useEffect(() => {
    setSkipped(localStorage.getItem(SKIP_KEY) === "true");
    setHydrated(true);

    function handleResume() {
      localStorage.removeItem(SKIP_KEY);
      setSkipped(false);
      setView("checklist");
    }
    window.addEventListener("onboarding:resume", handleResume);
    return () => window.removeEventListener("onboarding:resume", handleResume);
  }, []);

  // Auto-dismiss banner when the generation step completes
  useEffect(() => {
    if (view === "banner" && hasCompletedGeneration) {
      localStorage.setItem(SKIP_KEY, "true");
      setSkipped(true);
    }
  }, [hasCompletedGeneration, view]);

  const handleSkip = () => {
    localStorage.setItem(SKIP_KEY, "true");
    setSkipped(true);
  };

  const handleBrandComplete = () => {
    toast.success("Brand imported!");
    if (!hasPersonaWithImage) {
      setView("step-persona");
    } else if (!hasCompletedGeneration) {
      setView("step-video");
    } else {
      setView("checklist");
    }
  };

  const handlePersonaComplete = () => {
    toast.success("Persona created!");
    if (!hasCompletedGeneration) {
      setView("step-video");
    } else {
      setView("checklist");
    }
  };

  const handleLaunchGenerator = () => {
    const wizardStore = useGenerationWizardStore.getState();
    // Only initialize wizard for a fresh start — if the user already has
    // composites or a pending script in the store, preserve their session
    // entirely so we don't trigger expensive regeneration.
    const hasPriorSession = !!(wizardStore.compositeImagePath || wizardStore.pendingScript || wizardStore.pendingGenerationId);
    if (!hasPriorSession && products && products.length > 0) {
      wizardStore.setProductId(products[0].id);
      wizardStore.setStep(1);
    }
    setView("banner");
    router.push("/generate");
  };

  // Suppress the blocking overlay (not banner) if the user has an active wizard session
  if (allDone || skipped || (hasActiveWizardSession && view !== "banner")) return null;

  if (!hydrated || isLoading) {
    return (
      <AnimatePresence>
        <>
          <motion.div
            key="onboarding-backdrop-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-background/65 backdrop-blur-md"
            aria-hidden="true"
          />
          <motion.div
            key="onboarding-skeleton"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
              <div className="shrink-0 border-b border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-9 rounded-xl bg-muted animate-pulse" />
                  <div className="flex flex-col gap-1.5">
                    <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  {[1,2,3].map(i => <div key={i} className="h-7 flex-1 rounded-full bg-muted animate-pulse" />)}
                </div>
                <div className="h-1 w-full rounded bg-muted animate-pulse" />
              </div>
              <div className="flex flex-col gap-3 p-6">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 w-full rounded-xl border border-border bg-muted/50 animate-pulse" />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      </AnimatePresence>
    );
  }

  // ── Banner mode: no blur, just a floating pill at the top ─────────────────
  if (view === "banner") {
    return (
      <AnimatePresence>
        <GuideBanner
          key="guide-banner"
          onGoGenerate={() => router.push("/generate")}
          onDismiss={handleSkip}
        />
      </AnimatePresence>
    );
  }

  // ── Full modal mode ───────────────────────────────────────────────────────
  const modalWidth =
    view === "step-persona"
      ? "max-w-2xl"
      : "max-w-xl";

  return (
    <AnimatePresence>
      <>
        {/* Backdrop — blurs & dims all content behind the modal */}
        <motion.div
          key="onboarding-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-40 bg-background/65 backdrop-blur-md"
          aria-hidden="true"
        />

        {/* Modal */}
        <motion.div
          key={`onboarding-modal-${view}`}
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className={cn(
              "flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
              "max-h-[90vh]",
              modalWidth,
            )}
          >
            {/* Header — always visible */}
            <WizardHeader
              view={view}
              completedCount={completedCount}
              doneMap={doneMap}
              onClose={handleSkip}
              onNavigate={setView}
            />

            {/* Scrollable content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {view === "checklist" && (
                <ChecklistView doneMap={doneMap} onStartStep={setView} />
              )}
              {view === "step-brand" && (
                <BrandImportView
                  onComplete={handleBrandComplete}
                  onBack={() => setView("checklist")}
                />
              )}
              {view === "step-persona" && (
                <PersonaView
                  onComplete={handlePersonaComplete}
                  onBack={() => setView("step-brand")}
                />
              )}
              {view === "step-video" && (
                <VideoLaunchView
                  onLaunch={handleLaunchGenerator}
                  onBack={() => setView("step-persona")}
                  products={products ?? []}
                  personas={(personas ?? []).filter(
                    (p) => p.selected_image_url != null,
                  )}
                />
              )}
            </div>

            {/* Footer skip — only shown on checklist */}
            {view === "checklist" && (
              <div className="shrink-0 border-t border-border px-6 py-3">
                <button
                  onClick={handleSkip}
                  className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Skip tutorial
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
}

// ─── Wizard Header ────────────────────────────────────────────────────────────

function WizardHeader({
  view,
  completedCount,
  doneMap,
  onClose,
  onNavigate,
}: {
  view: WizardView;
  completedCount: number;
  doneMap: Record<
    "hasProduct" | "hasPersonaWithImage" | "hasCompletedGeneration",
    boolean
  >;
  onClose: () => void;
  onNavigate: (view: WizardView) => void;
}) {
  const activeStep = STEPS.find((s) => s.view === view);
  const title =
    view === "checklist"
      ? "Welcome! Let's get you set up."
      : (activeStep?.title ?? "Setup");

  return (
    <div className="shrink-0 border-b border-border p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="size-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold leading-tight text-foreground">
            {title}
          </h2>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {STEPS.length} steps complete
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close onboarding"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Step pills */}
      <div className="mb-3 flex gap-2">
        {STEPS.map((step, i) => {
          const done = doneMap[step.doneKey];
          const isCurrentView = step.view === view;
          const isNextActive =
            !done &&
            STEPS.slice(0, i).every((s) => doneMap[s.doneKey]) &&
            view === "checklist";

          return (
            <button
              key={step.key}
              onClick={() => done ? onNavigate(step.view) : undefined}
              disabled={!done && !isCurrentView}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-all",
                done &&
                  "cursor-pointer bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25",
                (isCurrentView || isNextActive) &&
                  !done &&
                  "bg-primary/15 text-primary",
                !done &&
                  !isCurrentView &&
                  !isNextActive &&
                  "bg-muted text-muted-foreground opacity-60",
              )}
            >
              {done ? (
                <CheckCircle2 className="size-3.5 shrink-0" />
              ) : (
                <span className="flex size-4 shrink-0 items-center justify-center text-[10px] font-bold opacity-70">
                  {i + 1}
                </span>
              )}
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>

      <Progress
        value={Math.round((completedCount / STEPS.length) * 100)}
        className="h-1 bg-muted [&>[data-slot=progress-indicator]]:bg-primary"
      />
    </div>
  );
}

// ─── Checklist View ───────────────────────────────────────────────────────────

function ChecklistView({
  doneMap,
  onStartStep,
}: {
  doneMap: Record<
    "hasProduct" | "hasPersonaWithImage" | "hasCompletedGeneration",
    boolean
  >;
  onStartStep: (view: WizardView) => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-6">
      <p className="text-sm text-muted-foreground">
        Complete these 3 steps to launch your first UGC video ad.
      </p>

      {STEPS.map((step, index) => {
        const done = doneMap[step.doneKey];
        const prevDone = index === 0 || doneMap[STEPS[index - 1].doneKey];
        const isActive = !done && prevDone;
        const Icon = step.icon;

        return (
          <div
            key={step.key}
            className={cn(
              "flex items-start gap-4 rounded-xl border p-4 transition-all duration-200",
              done && "border-emerald-500/20 bg-emerald-500/5",
              isActive &&
                "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/10",
              !done && !isActive && "border-border bg-background opacity-40",
            )}
          >
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
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
              )}
            </div>

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

            {done && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 gap-1.5 text-muted-foreground"
                onClick={() => onStartStep(step.view)}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
            {isActive && (
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => onStartStep(step.view)}
              >
                Start
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Brand Import View ────────────────────────────────────────────────────────

function BrandImportView({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const scrapeProduct = useScrapeProduct();

  const [importUrl, setImportUrl] = useState("");
  const [importTab, setImportTab] = useState<"import-url" | "upload">("import-url");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] =
    useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  async function handleScrape() {
    if (!importUrl.trim()) return;
    setScrapeError(null);

    try {
      const result: ScrapeResponseData = await scrapeProduct.mutateAsync({
        url: importUrl.trim(),
      });

      if (result.products.length === 0) {
        if (result.blocked_by_robots) {
          throw new Error(
            "This store blocks automated scraping (robots.txt). Use the manual upload tab instead.",
          );
        }
        throw new Error(
          "No products found at this URL. Try pasting a direct product page URL.",
        );
      }

      if (result.save_failed) {
        const detail = result.save_error ? ` (${result.save_error})` : "";
        throw new Error(
          `Products found but could not be saved. Please try again.${detail}`,
        );
      }

      const scraped: Product[] = result.products
        .filter((p) => p.id != null)
        .map((p) => ({
          id: p.id!,
          owner_id: "",
          store_url: null,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          images: p.images,
          brand_summary: p.brand_summary as BrandSummary | null,
          category: p.category,
          source: p.source as Product["source"],
          confirmed: false,
          created_at: "",
          updated_at: "",
        }));

      setScrapedProducts(scraped);
      setScrapedBrandSummary(result.brand_summary ?? null);
      setShowScrapeResults(true);
      setImportUrl("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to import products";
      setScrapeError(msg);
      toast.error(msg, { action: { label: "Retry", onClick: handleScrape } });
    }
  }

  function handleScrapeConfirmed() {
    setShowScrapeResults(false);
    setScrapedProducts([]);
    setScrapedBrandSummary(null);
    setShowSuccess(true);
    setTimeout(onComplete, 1500);
  }

  function handleUploadSuccess() {
    // ManualUploadForm does not invalidate the RQ cache — we do it here
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setShowSuccess(true);
    setTimeout(onComplete, 1500);
  }

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 p-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15"
        >
          <CheckCircle2 className="size-8 text-emerald-500" />
        </motion.div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Brand imported!</p>
          <p className="text-sm text-muted-foreground">Moving to your persona...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <BackButton onClick={onBack} />

      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Add your first product
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Paste your store URL for automatic import, or upload a product
          manually.
        </p>
      </div>

      {showScrapeResults ? (
        <div className="flex flex-col gap-4">
          <ScrapeResults
            products={scrapedProducts}
            brandSummary={scrapedBrandSummary}
            onConfirmed={handleScrapeConfirmed}
          />
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              setShowScrapeResults(false);
              setScrapedProducts([]);
              setScrapedBrandSummary(null);
            }}
          >
            <ArrowLeft className="size-3.5" />
            Import a different URL
          </Button>
        </div>
      ) : (
        <Tabs value={importTab} onValueChange={(v) => setImportTab(v as "import-url" | "upload")} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="import-url" className="flex-1">
              <LinkIcon className="size-3.5" />
              Import from URL
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1">
              <Upload className="size-3.5" />
              Upload Manually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import-url" className="pt-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-product-url">Store or product URL</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="wizard-product-url"
                    placeholder="https://yourstore.com/products/…"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleScrape();
                      }
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Supports Shopify and most e-commerce platforms.
                </p>
                {scrapeError && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-destructive">{scrapeError}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                      <AlertCircle className="size-3.5 shrink-0 text-amber-600" />
                      <span className="flex-1 text-xs text-amber-700 dark:text-amber-400">
                        Having trouble? Try uploading manually instead.
                      </span>
                      <button
                        type="button"
                        onClick={() => setImportTab("upload")}
                        className="text-xs font-medium text-primary underline underline-offset-2"
                      >
                        Switch →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleScrape}
                disabled={!importUrl.trim() || scrapeProduct.isPending}
              >
                {scrapeProduct.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import products"
                )}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="pt-4">
            <ManualUploadForm onSuccess={handleUploadSuccess} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Persona View ─────────────────────────────────────────────────────────────

function PersonaView({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack: () => void;
}) {
  const [showSuccess, setShowSuccess] = useState(false);

  function handleSaved() {
    setShowSuccess(true);
    setTimeout(onComplete, 1500);
  }

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-10 p-5">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15"
        >
          <CheckCircle2 className="size-8 text-emerald-500" />
        </motion.div>
        <div className="text-center">
          <p className="text-base font-semibold text-foreground">Persona created!</p>
          <p className="text-sm text-muted-foreground">Your AI spokesperson is ready...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <BackButton onClick={onBack} />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Create your AI Spokesperson</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Design the face of your brand. This persona will appear in all your videos — take a moment to get them just right.
        </p>
      </div>
      <PersonaBuilderInline onSaved={handleSaved} onCancel={onBack} />
    </div>
  );
}

// ─── Video Launch View ────────────────────────────────────────────────────────

function VideoLaunchView({
  onLaunch,
  onBack,
  products,
  personas,
}: {
  onLaunch: () => void;
  onBack: () => void;
  products: Product[];
  personas: Persona[];
}) {
  const firstProduct = products[0];
  const firstPersona = personas[0];

  return (
    <div className="flex flex-col gap-5 p-6">
      <BackButton onClick={onBack} />

      <div>
        <h3 className="text-sm font-semibold text-foreground">
          You&apos;re all set! 🎬
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your brand and persona are ready. Generate your first UGC ad now.
        </p>
      </div>

      {/* Summary cards */}
      {(firstProduct || firstPersona) && (
        <div className="grid grid-cols-2 gap-3">
          {firstProduct && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Product
              </p>
              <div className="flex items-center gap-2">
                {firstProduct.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firstProduct.images[0]}
                    alt={firstProduct.name}
                    className="size-8 shrink-0 rounded object-cover"
                  />
                ) : (
                  <Package className="size-5 shrink-0 text-muted-foreground" />
                )}
                <p className="line-clamp-2 text-xs font-medium text-foreground">
                  {firstProduct.name}
                </p>
              </div>
            </div>
          )}
          {firstPersona && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Persona
              </p>
              <div className="flex items-center gap-2">
                {firstPersona.selected_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={firstPersona.selected_image_url}
                    alt={firstPersona.name}
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <User className="size-5 shrink-0 text-muted-foreground" />
                )}
                <p className="line-clamp-1 text-xs font-medium text-foreground">
                  {firstPersona.name}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <Button size="lg" className="w-full gap-2" onClick={onLaunch}>
        <Film className="size-4" />
        Open Video Generator
        <ArrowRight className="size-4" />
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        A small guide will appear at the top while you generate your first
        video.
      </p>
    </div>
  );
}

// ─── Guide Banner (step 3 — no blur) ─────────────────────────────────────────

function GuideBanner({
  onGoGenerate,
  onDismiss,
}: {
  onGoGenerate: () => void;
  onDismiss: () => void;
}) {
  const pathname = usePathname();
  const isOnGeneratePage = pathname === "/generate";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 shadow-lg"
    >
      <div className="flex items-center gap-2 text-sm">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span className="font-medium text-foreground">Step 3/3:</span>
        <span className="hidden text-muted-foreground sm:inline">
          Generate your first video
        </span>
      </div>

      {!isOnGeneratePage && (
        <>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm"
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
            onClick={onGoGenerate}
          >
            Go to generator
            <ArrowRight className="size-3" />
          </Button>
        </>
      )}

      <button
        onClick={onDismiss}
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Dismiss tutorial"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-3.5" />
      Back
    </button>
  );
}
