"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { usePersonas, useGeneratePersonaImages, useSelectPersonaImage } from "@/hooks/use-personas";
import { isExternalUrl, getSignedImageUrl, getSignedImageUrls } from "@/lib/storage";
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
  ArrowLeft,
  LinkIcon,
  Upload,
  Loader2,
  X,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
    description: "Create your AI spokesperson. Customize look, style & vibe. They'll star in every video you make. (~5 min)",
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
  const { isLoaded: authLoaded } = useAuth();
  const [view, setView] = useState<WizardView>("checklist");
  const [skipped, setSkipped] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // Track whether we've done the first stable skip-state read
  const skipInitialized = useRef(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: generations, isLoading: generationsLoading } = useGenerations();

  // Resolve signed URLs for product images in the picker modal
  const [productImageMap, setProductImageMap] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!products || products.length === 0) return;
    let cancelled = false;
    async function resolve() {
      const result: Record<string, string | null> = {};
      const toSign: { id: string; path: string }[] = [];
      for (const p of products!) {
        const raw = p.images?.[0];
        if (!raw) { result[p.id] = null; }
        else if (isExternalUrl(raw)) { result[p.id] = raw; }
        else { result[p.id] = null; toSign.push({ id: p.id, path: raw }); }
      }
      if (!cancelled) setProductImageMap({ ...result });
      if (toSign.length > 0) {
        const signed = await getSignedImageUrls("product-images", toSign.map(x => x.path));
        if (!cancelled) {
          signed.forEach((url, i) => { result[toSign[i].id] = url; });
          setProductImageMap({ ...result });
        }
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [products]);

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

  // Read skip state from localStorage only once auth has loaded and data is stable.
  // IMPORTANT: Never read/write skip state while isLoading=true — a mid-flight
  // refetch (e.g. after scraping) would incorrectly close the modal.
  // Also guard against Clerk not yet loaded: before that, queries are disabled
  // so hasProduct/hasPersona/hasGeneration are all false even for existing users.
  useEffect(() => {
    if (!authLoaded || isLoading) {
      // Still mark hydrated so the loading skeleton can render
      if (authLoaded) setHydrated(true);
      return;
    }
    if (!hasProduct && !hasPersonaWithImage && !hasCompletedGeneration) {
      // Truly new user (or all data wiped) — always show onboarding fresh
      localStorage.removeItem(SKIP_KEY);
      setSkipped(false);
    } else if (!skipInitialized.current) {
      // First stable read for a returning user — respect their saved preference
      setSkipped(localStorage.getItem(SKIP_KEY) === "true");
    }
    skipInitialized.current = true;
    setHydrated(true);
  }, [authLoaded, isLoading, hasProduct, hasPersonaWithImage, hasCompletedGeneration]);

  // Re-register the resume handler whenever onboarding state changes so the
  // closure always reads up-to-date completion flags rather than stale ones.
  useEffect(() => {
    function handleResume() {
      localStorage.removeItem(SKIP_KEY);
      setSkipped(false);
      setHasActiveWizardSession(false);
      // Jump directly to the first incomplete step so the user doesn't have to
      // click through the checklist when resuming mid-onboarding.
      if (!hasProduct) {
        setView("step-brand");
      } else if (!hasPersonaWithImage) {
        setView("step-persona");
      } else if (!hasCompletedGeneration) {
        setView("step-video");
      } else {
        setView("checklist");
      }
    }
    window.addEventListener("onboarding:resume", handleResume);
    return () => window.removeEventListener("onboarding:resume", handleResume);
  }, [hasProduct, hasPersonaWithImage, hasCompletedGeneration]);

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
    // Only initialize wizard for a fresh start - if the user already has
    // composites or a pending script in the store, preserve their session
    // entirely so we don't trigger expensive regeneration.
    const hasPriorSession = !!(wizardStore.compositeImagePath || wizardStore.pendingScript || wizardStore.pendingGenerationId);

    // Auto-select persona (first persona with a selected image from onboarding)
    const personaWithImage = (personas ?? []).find(p => p.selected_image_url != null);
    if (personaWithImage && !hasPriorSession) {
      wizardStore.setPersonaId(personaWithImage.id);
    }

    if (!hasPriorSession && products && products.length > 0) {
      if (products.length === 1) {
        // Only one product - auto-select silently
        wizardStore.setProductId(products[0].id);
        if (!wizardStore.format) wizardStore.setFormat("9:16");
        wizardStore.setStep(2);
        setView("banner");
        router.push("/generate");
      } else {
        // Multiple products - show picker modal
        setShowProductPicker(true);
      }
    } else {
      setView("banner");
      router.push("/generate");
    }
  };

  const handleProductPickerSelect = (productId: string) => {
    const wizardStore = useGenerationWizardStore.getState();
    wizardStore.setProductId(productId);
    if (!wizardStore.format) wizardStore.setFormat("9:16");
    wizardStore.setStep(2);
    setShowProductPicker(false);
    setView("banner");
    router.push("/generate");
  };

  // Wait for localStorage to be read before showing anything — prevents flash
  // of the loading skeleton for users who already dismissed the overlay.
  if (!hydrated) return null;

  // Suppress the blocking overlay (not banner) if the user has an active wizard session
  if (allDone || skipped || (hasActiveWizardSession && view !== "banner")) return null;

  if (isLoading) {
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
            <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
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

  // ── Product picker modal ──────────────────────────────────────────────────
  if (showProductPicker) {
    return (
      <Dialog open={showProductPicker} onOpenChange={(open) => { if (!open) setShowProductPicker(false); }}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Which product are you promoting?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-1 max-h-[65vh] overflow-y-auto pr-1">
            {(products ?? []).map((product) => (
              <button
                key={product.id}
                onClick={() => handleProductPickerSelect(product.id)}
                className="group overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/60 hover:shadow-md"
              >
                {/* Image — square, neutral bg so products are clearly visible */}
                <div className="relative aspect-square w-full overflow-hidden bg-white">
                  {productImageMap[product.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productImageMap[product.id]!}
                      alt={product.name}
                      className="size-full object-contain p-3 transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : product.images?.[0] && productImageMap[product.id] === undefined ? (
                    // Signing in progress — show shimmer
                    <div className="size-full bg-muted animate-pulse" />
                  ) : (
                    <div className="flex size-full items-center justify-center bg-muted/40">
                      <Package className="size-10 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                {/* Name */}
                <div className="border-t border-border/50 bg-muted/20 px-3 py-2.5">
                  <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                    {product.name}
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mt-1 w-full rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowProductPicker(false)}
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Full modal mode ───────────────────────────────────────────────────────
  const modalWidth = view === "step-persona" ? "max-w-6xl" : "max-w-4xl";

  return (
    <AnimatePresence>
      <>
        {/* Backdrop - blurs & dims all content behind the modal */}
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
            {/* Header - always visible */}
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
                  onBack={() => hasProduct ? setView("checklist") : setView("step-brand")}
                  onProceedToVideo={() => setView("step-video")}
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

            {/* Footer skip - only shown on checklist */}
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
  const { data: products } = useProducts();
  const scrapeProduct = useScrapeProduct();

  const [importUrl, setImportUrl] = useState("");
  const [importTab, setImportTab] = useState<"import-url" | "upload">("import-url");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] =
    useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [forceShowForm, setForceShowForm] = useState(false);

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
    // ManualUploadForm does not invalidate the RQ cache - we do it here
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

  // If brand already imported, show confirmation instead of blank form
  if (products && products.length > 0 && !showScrapeResults && !forceShowForm) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <BackButton onClick={onBack} />
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="size-7 text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Brand already imported</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {products.length} product{products.length > 1 ? "s" : ""} ready - {products[0].name}
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={onComplete} className="gap-1.5">
              Continue <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setForceShowForm(true)}>
              Re-import
            </Button>
          </div>
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
  onProceedToVideo,
}: {
  onComplete: () => void;
  onBack: () => void;
  onProceedToVideo: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: personas } = usePersonas();
  const generateImages = useGeneratePersonaImages();
  const selectImage = useSelectPersonaImage();

  const [showSuccess, setShowSuccess] = useState(false);
  const [addPhotoPersonaId, setAddPhotoPersonaId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectingIndex, setSelectingIndex] = useState<number | null>(null);
  const [canProceedWhileGenerating, setCanProceedWhileGenerating] = useState(false);

  // If a persona with image already exists (race condition / cache refresh), complete immediately
  useEffect(() => {
    if (personas?.some((p) => p.selected_image_url)) {
      onComplete();
    }
  }, [personas, onComplete]);

  const personasWithoutImage = (personas ?? []).filter((p) => !p.selected_image_url);
  const hasExistingPersonas = personasWithoutImage.length > 0;


  function handleSaved() {
    setCanProceedWhileGenerating(false);
    setShowSuccess(true);
    setTimeout(onComplete, 1500);
  }

  async function handleGenerateForExisting(persona: Persona) {
    try {
      const result = await generateImages.mutateAsync({
        name: persona.name,
        attributes: (persona.attributes as unknown as Record<string, unknown>) ?? {},
      });
      // Store the new persona id so we can select an image for it
      setAddPhotoPersonaId(result.data.id);
      setGeneratedImages(result.data.generated_image_urls ?? result.data.generated_images ?? []);
    } catch {
      toast.error("Failed to generate images. Please try again.");
    }
  }

  async function handleSelectGeneratedImage(imageIndex: number) {
    if (!addPhotoPersonaId) return;
    setSelectingIndex(imageIndex);
    try {
      await selectImage.mutateAsync({ persona_id: addPhotoPersonaId, image_index: imageIndex });
      await queryClient.invalidateQueries({ queryKey: ["personas"] });
      setCanProceedWhileGenerating(false);
      setShowSuccess(true);
      setTimeout(onComplete, 1500);
    } catch {
      toast.error("Failed to save image. Please try again.");
    } finally {
      setSelectingIndex(null);
    }
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
          <p className="text-base font-semibold text-foreground">Persona ready!</p>
          <p className="text-sm text-muted-foreground">Your AI spokesperson is all set...</p>
        </div>
      </div>
    );
  }

  // ── Inline image picker for an existing persona ────────────────────────────
  if (generatedImages.length > 0 && addPhotoPersonaId) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <BackButton onClick={() => { setGeneratedImages([]); setAddPhotoPersonaId(null); }} />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pick a profile photo</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose the best look for your AI spokesperson.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {generatedImages.map((url, i) => (
            <button
              key={i}
              onClick={() => handleSelectGeneratedImage(i)}
              disabled={selectingIndex !== null}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border-2 transition-all",
                selectingIndex === i
                  ? "border-primary"
                  : "border-transparent hover:border-primary/60",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Option ${i + 1}`} className="size-full object-cover" />
              {selectingIndex === i && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="size-5 animate-spin text-white" />
                </div>
              )}
            </button>
          ))}

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
          Design the face of your brand. This persona will appear in all your videos.
        </p>
      </div>

      {(generateImages.isPending || canProceedWhileGenerating) && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {generateImages.isPending && (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            )}
            {generateImages.isPending
              ? "Portraits are generating in the background."
              : "You can continue to step 3 while portraits finish."}
          </div>
          <Button size="sm" variant="outline" onClick={onProceedToVideo}>
            Continue to step 3
          </Button>
        </div>
      )}

      {/* Existing personas without images - offer to add photo inline */}
      {hasExistingPersonas && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            You already have personas. Just add a profile photo:
          </p>
          {personasWithoutImage.map((persona) => (
            <div
              key={persona.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                  <User className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{persona.name}</p>
                  <p className="text-xs text-muted-foreground">No photo yet</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 text-xs"
                onClick={() => handleGenerateForExisting(persona)}
                disabled={generateImages.isPending}
              >
                {generateImages.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Add photo
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Or create a new persona below:</p>
        </div>
      )}

      <PersonaBuilderInline
        onSaved={handleSaved}
        onCancel={onBack}
        onGenerationStarted={(personaId) => {
          useGenerationWizardStore.getState().setPersonaId(personaId);
          setCanProceedWhileGenerating(true);
          toast.info("Portraits are generating. You can continue to step 3 now.");
        }}
      />
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

  // Resolve signed URL for the persona avatar
  const [personaAvatarUrl, setPersonaAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    const raw = firstPersona?.selected_image_url ?? null;
    if (!raw) { setPersonaAvatarUrl(null); return; }
    if (isExternalUrl(raw)) { setPersonaAvatarUrl(raw); return; }
    getSignedImageUrl("persona-images", raw).then((url) =>
      setPersonaAvatarUrl(url === "/placeholder-product.svg" ? null : url)
    );
  }, [firstPersona?.selected_image_url]);

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
                {personaAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={personaAvatarUrl}
                    alt={firstPersona.name}
                    className="size-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="size-4 text-muted-foreground" />
                  </div>
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

// ─── Guide Banner (step 3 - no blur) ─────────────────────────────────────────

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
