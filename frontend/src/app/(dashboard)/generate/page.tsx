"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ImageIcon,
  Loader2,
  Package,
  User,
  Zap,
  LinkIcon,
  Upload,
  Plus,
  Pencil,
  Star,
  Clock,
  Flame,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import { useFirstPurchaseOffer, COUPON_30_OFF, COUPON_50_OFF_FIRST_VIDEO } from "@/hooks/use-first-purchase-offer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PLANS,
  CREDIT_PACKS,
  CREDITS_PER_SINGLE,
  CREDITS_PER_BATCH,
  CREDITS_PER_SINGLE_HD,
  CREDITS_PER_BATCH_HD,
  type PlanTier,
  type CreditPackKey,
  type SingleVideoPackKey,
} from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useWatchedGenerationsStore } from "@/stores/watched-generations";
import { useProducts, useScrapeProduct } from "@/hooks/use-products";
import { isExternalUrl, getSignedImageUrls } from "@/lib/storage";
import { usePersonas, resolvePersonaImageUrl } from "@/hooks/use-personas";
import type { Persona, Product, BrandSummary } from "@/types/database";
import { useCredits } from "@/hooks/use-credits";
import {
  useGenerateCompositeImages,
  useGenerateScript,
  useApproveAndGenerate,
  useGenerations,
} from "@/hooks/use-generations";
import { useCheckout, useBuyCredits } from "@/hooks/use-checkout";
import { useProfile, ADVANCED_MODE_PLANS } from "@/hooks/use-profile";
import { ManualUploadForm } from "@/components/products/ManualUploadForm";
import { ScrapeResults } from "@/components/products/ScrapeResults";
import { PersonaBuilderInline } from "@/components/personas/PersonaBuilderInline";
import {
  trackProductImported,
  trackPreviewGenerated,
  trackScriptGenerated,
  trackVideoGenerationStarted,
  trackPaywallShown,
  trackCheckoutStarted,
  trackCreditsPurchased,
} from "@/lib/datafast";
import { NanoBananaLoader } from "@/components/ui/nano-loader";
import { callEdge, EdgeError } from "@/lib/api";

const LANGUAGE_OPTIONS = [
  { code: "en", native: "English"   },
  { code: "es", native: "Español"   },
  { code: "fr", native: "Français"  },
  { code: "de", native: "Deutsch"   },
  { code: "it", native: "Italiano"  },
  { code: "pt", native: "Português" },
  { code: "ja", native: "日本語"     },
  { code: "zh", native: "中文"       },
  { code: "ar", native: "العربية"   },
  { code: "ru", native: "Русский"   },
] as const;

const CTA_STYLE_OPTIONS = [
  { key: "auto",              label: "Auto",            description: "Mixes CTA styles for variety" },
  { key: "product_name_drop", label: "Name Drop",       description: "Mentions the product name directly" },
  { key: "link_in_bio",       label: "Link in Bio",     description: "Directs viewers to your bio link" },
  { key: "comment_keyword",   label: "Comment Keyword", description: "Triggers automation (e.g. ManyChat)" },
  { key: "direct_website",    label: "Direct Website",  description: "Shows your store URL on screen" },
  { key: "discount_code",     label: "Discount Code",   description: "Highlights a promo code on screen" },
  { key: "link_in_comments",  label: "Link in Comments",description: "Directs viewers to comments" },
  { key: "check_description", label: "Check Description",description: "Points to the caption/description" },
] as const;

const VIDEO_GEN_STEPS = [
  { label: "Creating scene previews",    icon: <ImageIcon className="w-3 h-3" /> },
  { label: "Writing ad script",          icon: <Zap className="w-3 h-3" /> },
  { label: "Launching video generation", icon: <Zap className="w-3 h-3" /> },
];

const PLAN_BENEFITS: Record<PlanTier, string[]> = {
  starter: ["Standard rendering queue", "Watermark-free exports", "Commercial use license", "Standard support"],
  growth: ["Fast rendering priority", "Watermark-free exports", "Commercial use license", "Priority support"],
  scale: ["Highest rendering priority", "Watermark-free exports", "Commercial use license", "Dedicated manager", "Custom API limits"],
};

function useResolvedProductImages(
  products: { id: string; images: string[] }[] | undefined,
) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!products || products.length === 0) return;
    let cancelled = false;
    async function resolve() {
      const result: Record<string, string | null> = {};
      const pathsToSign: { productId: string; path: string }[] = [];

      for (const p of products!) {
        const raw = p.images?.[0];
        if (!raw) { result[p.id] = null; }
        else if (isExternalUrl(raw)) { result[p.id] = raw; }
        else { result[p.id] = null; pathsToSign.push({ productId: p.id, path: raw }); }
      }
      if (!cancelled) setImageMap({ ...result });

      if (pathsToSign.length > 0) {
        const signedUrls = await getSignedImageUrls("product-images", pathsToSign.map((p) => p.path));
        if (!cancelled) {
          signedUrls.forEach((url, i) => { result[pathsToSign[i].productId] = url; });
          setImageMap({ ...result });
        }
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [products]);

  return imageMap;
}

function useResolvedAllProductImages(product: { images: string[] } | undefined) {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product?.images || product.images.length === 0) { setUrlMap({}); return; }
    let cancelled = false;
    async function resolve() {
      const result: Record<string, string> = {};
      const toSign: string[] = [];
      for (const raw of product!.images) {
        if (!raw || typeof raw !== "string") continue;
        if (isExternalUrl(raw)) result[raw] = raw; else toSign.push(raw);
      }
      if (toSign.length > 0) {
        const signedUrls = await getSignedImageUrls("product-images", toSign);
        signedUrls.forEach((url, i) => { if (url) result[toSign[i]] = url; });
      }
      if (!cancelled) setUrlMap(result);
    }
    resolve();
    return () => { cancelled = true; };
  }, [product]);

  return urlMap;
}

function useResolvedPersonaImages(personas: Persona[] | undefined) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!personas || personas.length === 0) return;
    let cancelled = false;
    async function resolve() {
      const result: Record<string, string | null> = {};
      const pathsToSign: { personaId: string; path: string }[] = [];

      for (const p of personas!) {
        const raw = p.selected_image_url ?? p.generated_images?.[0] ?? null;
        if (!raw) { result[p.id] = null; }
        else if (raw.startsWith("http")) { result[p.id] = raw; }
        else { result[p.id] = null; pathsToSign.push({ personaId: p.id, path: raw }); }
      }
      if (!cancelled) setImageMap({ ...result });

      if (pathsToSign.length > 0) {
        const supabase = createClient();
        const { data } = await supabase.storage
          .from("persona-images")
          .createSignedUrls(pathsToSign.map((p) => p.path), 3600);
        if (data && !cancelled) {
          data.forEach((item: { signedUrl?: string | null }, i: number) => {
            result[pathsToSign[i].personaId] = item.signedUrl ?? null;
          });
          setImageMap({ ...result });
        }
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [personas]);

  return imageMap;
}

export default function GeneratePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const store = useGenerationWizardStore();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTab, setPaywallTab] = useState<"single" | "subscription">("single");

  // Validate persisted pendingGenerationId against DB on mount
  useEffect(() => {
    if (!store.pendingGenerationId) return;
    const supabase = createClient();
    supabase
      .from("generations")
      .select("status")
      .eq("id", store.pendingGenerationId)
      .single()
      .then(({ data }: { data: { status: string } | null }) => {
        if (!data || data.status !== "awaiting_approval") {
          store.clearPendingScript();
          if (store.step >= 4) store.setStep(3);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-close paywall when returning from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") setShowPaywall(false);
  }, []);

  // Product import state
  const [addingProduct, setAddingProduct] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);

  // Persona builder state
  const [buildingPersona, setBuildingPersona] = useState(false);
  const [showPersonaLimitPaywall, setShowPersonaLimitPaywall] = useState(false);

  // CTA open state
  const [ctaOpen, setCtaOpen] = useState(false);
  const [showMoreCta, setShowMoreCta] = useState(false);

  // Video loader state
  const [videoLoaderProgress, setVideoLoaderProgress] = useState(0);
  const [videoLoaderStep, setVideoLoaderStep] = useState(-1);
  const videoSimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: products, isLoading: productsLoading } = useProducts();
  const productImageMap = useResolvedProductImages(products);
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const personaImageMap = useResolvedPersonaImages(personas);
  const scrapeProduct = useScrapeProduct();
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const generateComposites = useGenerateCompositeImages();
  const generateScript = useGenerateScript();
  const approveAndGenerate = useApproveAndGenerate();
  const watchedGenerationsStore = useWatchedGenerationsStore();
  const checkout = useCheckout();
  const buyCredits = useBuyCredits();
  const offer = useFirstPurchaseOffer();
  const { data: generations } = useGenerations();

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const activePersonas = personas ?? [];

  const selectedProduct = confirmedProducts.find((p) => p.id === store.productId);
  const selectedProductAllImages = useResolvedAllProductImages(selectedProduct);
  const selectedPersona = activePersonas.find((p) => p.id === store.personaId);

  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const userPlan = profile?.plan ?? "free";
  const creditCost =
    store.quality === "hd"
      ? store.mode === "single" ? CREDITS_PER_SINGLE_HD : CREDITS_PER_BATCH_HD
      : store.mode === "single" ? CREDITS_PER_SINGLE : CREDITS_PER_BATCH;

  const isFirstVideo = profile?.first_video_discount_used === false;
  const effectiveCost = creditCost;
  const hasEnoughCredits = isUnlimitedCredits || creditsRemaining >= effectiveCost;
  const requiresCommentKeyword = store.ctaStyle === "comment_keyword";
  const commentKeyword = store.ctaCommentKeyword.trim().replace(/[^a-zA-Z0-9 _-]/g, "");

  const showAddProductForm =
    addingProduct || (!productsLoading && confirmedProducts.length === 0);

  const showPersonaBuilder =
    buildingPersona || (!personasLoading && activePersonas.length === 0);

  // Auto-start first-purchase offer timer on mount
  useEffect(() => {
    if (!isFirstVideo || profile === undefined) return;
    offer.startOffer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstVideo, profile !== undefined]);

  // Cleanup interval on unmount
  useEffect(() => () => stopVideoSim(), []);

  // ── Section navigation ────────────────────────────────────────────────

  function handleOpenSection(section: 1 | 2) {
    store.clearPendingScript();
    store.setCompositeImagePath(null);
    if (section === 1) {
      store.setSelectedProductImages([]);
      store.setStep(1);
    } else {
      store.setStep(2);
    }
  }

  // ── Product import handlers ──────────────────────────────────────────────

  async function handleScrape() {
    if (!importUrl.trim()) return;
    setScrapeError(null);
    try {
      const result = await scrapeProduct.mutateAsync({ url: importUrl.trim() });
      if (result.products.length === 0) {
        if (result.blocked_by_robots) throw new Error("This store blocks automated scraping (robots.txt). Try manual upload.");
        throw new Error("No products could be extracted from this URL. Try a direct product page.");
      }
      if (result.save_failed) {
        const detail = result.save_error ? ` (${result.save_error})` : "";
        throw new Error(`We scraped this page but could not save products to your account. Please try again.${detail}`);
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
      if (scraped.length === 0) throw new Error("Products were found but none were saved to your account. Please try again.");
      setScrapedProducts(scraped);
      setScrapedBrandSummary(result.brand_summary ?? null);
      setShowScrapeResults(true);
      setImportUrl("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import product";
      setScrapeError(message);
      toast.error(message, { action: { label: "Retry", onClick: handleScrape } });
    }
  }

  function handleScrapeConfirmed() {
    const firstId = scrapedProducts[0]?.id;
    setScrapedProducts([]);
    setScrapedBrandSummary(null);
    setShowScrapeResults(false);
    setAddingProduct(false);
    setScrapeError(null);
    trackProductImported("url");
    queryClient.invalidateQueries({ queryKey: ["products"] });
    if (firstId) {
      store.setProductId(firstId);
      store.setStep(2);
    }
    toast.success("Products imported! Select one to continue.");
  }

  function handleManualUploadSuccess() {
    trackProductImported("manual");
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setAddingProduct(false);
  }

  function handleCancelAddProduct() {
    setAddingProduct(false);
    setShowScrapeResults(false);
    setScrapedProducts([]);
    setScrapedBrandSummary(null);
    setImportUrl("");
    setScrapeError(null);
  }

  // ── Video loader simulation helpers ──────────────────────────────────────

  function startVideoSim(fromPct: number, toPct: number, durationMs: number, onDone?: () => void) {
    if (videoSimRef.current) clearInterval(videoSimRef.current);
    const start = Date.now();
    videoSimRef.current = setInterval(() => {
      const t = Math.min((Date.now() - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      setVideoLoaderProgress(Math.round(fromPct + (toPct - fromPct) * eased));
      if (t >= 1) {
        clearInterval(videoSimRef.current!);
        videoSimRef.current = null;
        onDone?.();
      }
    }, 80);
  }

  function stopVideoSim() {
    if (videoSimRef.current) { clearInterval(videoSimRef.current); videoSimRef.current = null; }
  }

  // ── Main generate handler (chains composites → script → approve) ──────────

  async function handleGenerate() {
    if (!store.productId || !store.personaId) return;
    if (!isUnlimitedCredits && creditsRemaining < effectiveCost) {
      trackPaywallShown("insufficient_credits");
      offer.startOffer();
      setPaywallTab(creditCost > CREDITS_PER_SINGLE_HD ? "subscription" : "single");
      setShowPaywall(true);
      return;
    }
    if (requiresCommentKeyword && !commentKeyword) {
      toast.error("Add a comment keyword for the CTA style.");
      return;
    }

    // Default to portrait format
    store.setFormat("9:16");

    setVideoLoaderStep(0);
    setVideoLoaderProgress(5);
    startVideoSim(5, 25, 30_000);

    try {
      // 1. Generate composite images
      const compositesResult = await generateComposites.mutateAsync({
        product_id: store.productId,
        persona_id: store.personaId,
        format: "9:16",
        ...(store.selectedProductImages.length > 0 && { selected_images: store.selectedProductImages }),
      });

      if (!compositesResult.images.length) throw new Error("No composite images generated");
      const compositePath = compositesResult.images[0].path;
      store.setCompositeImagePath(compositePath);
      trackPreviewGenerated();

      stopVideoSim();
      setVideoLoaderStep(1);
      setVideoLoaderProgress(30);
      startVideoSim(30, 55, 75_000);

      // 2. Generate script
      const scriptResult = await generateScript.mutateAsync({
        product_id: store.productId,
        persona_id: store.personaId,
        mode: store.mode,
        quality: store.quality,
        composite_image_path: compositePath,
        cta_style: store.ctaStyle,
        cta_comment_keyword: requiresCommentKeyword ? commentKeyword : undefined,
        language: store.language,
        phase: "script",
      });

      if (!scriptResult.script || !scriptResult.generation_id) throw new Error("Script generation failed");
      store.setPendingScript(scriptResult.generation_id, scriptResult.script, scriptResult.credits_to_charge ?? effectiveCost);
      trackScriptGenerated(store.mode, store.quality);

      stopVideoSim();
      setVideoLoaderStep(2);
      setVideoLoaderProgress(60);
      startVideoSim(60, 70, 10_000);

      // 3. Approve and generate video
      await approveAndGenerate.mutateAsync({
        generation_id: scriptResult.generation_id,
        override_script: scriptResult.script,
        video_provider: store.videoProvider,
        video_quality: store.quality,
      });

      const genId = scriptResult.generation_id;
      trackVideoGenerationStarted(store.mode, store.quality);
      watchedGenerationsStore.add(genId, selectedProduct?.name);
      store.reset();
      router.push(`/generate/${genId}`);
      toast.success("Generation started!");
    } catch (err) {
      stopVideoSim();
      setVideoLoaderStep(-1);
      setVideoLoaderProgress(0);
      if (err instanceof EdgeError && (err.code === "INSUFFICIENT_CREDITS" || err.status === 402)) {
        trackPaywallShown("insufficient_credits");
        offer.startOffer();
        setPaywallTab(creditCost > CREDITS_PER_SINGLE_HD ? "subscription" : "single");
        setShowPaywall(true);
      } else if (err instanceof EdgeError && err.code === "RATE_LIMITED") {
        toast.error("You're generating too fast. Please wait a moment and try again.");
      } else {
        toast.error(err instanceof Error ? err.message : "Failed to generate video");
      }
    }
  }

  // ── Checkout / buy ──────────────────────────────────────────────────────

  async function handleCheckout(plan: PlanTier) {
    const couponId = COUPON_30_OFF;
    checkout.mutate({ plan, couponId }, {
      onSuccess: (url) => {
        trackCheckoutStarted(plan);
        if (couponId) offer.markUsed();
        window.location.href = url;
      },
      onError: (err) => { toast.error(err.message || "Failed to start checkout"); },
    });
  }

  async function handleBuyPack(pack: CreditPackKey | SingleVideoPackKey) {
    const isSingleVideo = pack === "single_standard" || pack === "single_hd";
    const couponId = isSingleVideo
      ? (isFirstVideo ? COUPON_50_OFF_FIRST_VIDEO : COUPON_30_OFF)
      : COUPON_30_OFF;
    buyCredits.mutate({ pack, couponId, generation_id: store.pendingGenerationId ?? undefined }, {
      onSuccess: (url) => {
        if (pack in { pack_10: 1, pack_30: 1, pack_100: 1 }) trackCreditsPurchased(pack as CreditPackKey);
        if (couponId) offer.markUsed();
        window.location.href = url;
      },
      onError: (err) => { toast.error(err.message || "Failed to start checkout"); },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const videosGenerated = (generations ?? []).filter((g) => g.status === "completed").length;

  const paywallHeadline =
    videosGenerated === 0
      ? "Create your first UGC ad - in seconds."
      : videosGenerated === 1
      ? "It works. Now scale your production."
      : "Scale your ad production.";

  const paywallSublineStatic =
    videosGenerated === 0
      ? "AI writes the script, composites your persona, and renders the video. No filming needed."
      : null;

  function handlePaywallClose(open: boolean) {
    if (!open && !hasEnoughCredits) {
      if (isFirstVideo) {
        toast("Your 50% first-video discount is still available!", {
          duration: 8000,
          icon: "🎬",
          action: { label: "Grab it", onClick: () => { offer.startOffer(); setShowPaywall(true); } },
        });
      } else if (videosGenerated > 0) {
        toast("Come back when you're ready to scale your production.", { duration: 5000 });
      }
    }
    setShowPaywall(open);
  }

  const section1Complete = store.step >= 2;
  const section2Complete = store.step >= 3;
  const section3Unlocked = store.step >= 3;

  // Detect orphaned awaiting_approval generation
  const orphanedDraft = useMemo(() => {
    if (store.pendingGenerationId) return null;
    return (generations ?? []).find((g) => g.status === "awaiting_approval") ?? null;
  }, [generations, store.pendingGenerationId]);

  const isGenerating = videoLoaderStep >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Orphaned draft banner ── */}
      {orphanedDraft && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">You have a script awaiting approval - no credits charged yet.</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 border-amber-500/40 text-amber-400 hover:bg-amber-500/10" onClick={() => router.push("/dashboard")}>
            Review &amp; Approve
          </Button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generate UGC Video</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create AI-powered video ads in a few simple steps.
            {!creditsLoading && (
              <span className="ml-2 font-medium text-foreground">
                {isUnlimitedCredits ? "Unlimited credits" : `${creditsRemaining} credits remaining`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Section 1: Product ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <div className={cn(
          "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4",
          section1Complete && "border-b-0",
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-bold",
              section1Complete ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground",
            )}>
              {section1Complete ? <Check className="size-3.5" /> : "1"}
            </div>
            <span className="text-sm font-semibold">
              {section1Complete && selectedProduct ? (
                <span className="truncate max-w-[200px] sm:max-w-none text-foreground">{selectedProduct.name}</span>
              ) : "Select Product"}
            </span>
          </div>
          {section1Complete && (
            <button type="button" onClick={() => handleOpenSection(1)} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
              Change
            </button>
          )}
        </div>

        {!section1Complete && (
          <div className="px-5 pb-5 flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Select a product</p>
                {!showAddProductForm && confirmedProducts.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setAddingProduct(true)}>
                    <Plus className="size-4" />Add Product
                  </Button>
                )}
                {showAddProductForm && confirmedProducts.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleCancelAddProduct}>← Back to products</Button>
                )}
              </div>

              {productsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
                </div>
              ) : showAddProductForm ? (
                showScrapeResults && scrapedProducts.length > 0 ? (
                  <ScrapeResults products={scrapedProducts} brandSummary={scrapedBrandSummary} onConfirmed={handleScrapeConfirmed} />
                ) : (
                  <Tabs defaultValue="import-url" className="w-full">
                    <TabsList className="w-full">
                      <TabsTrigger value="import-url" className="flex-1">
                        <LinkIcon className="size-3.5" />Import from URL
                      </TabsTrigger>
                      <TabsTrigger value="upload" className="flex-1">
                        <Upload className="size-3.5" />Upload Manually
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="import-url">
                      <div className="flex flex-col gap-4 pt-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="product-url">Product URL</Label>
                          <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="product-url"
                              placeholder="https://store.com/products/..."
                              value={importUrl}
                              onChange={(e) => setImportUrl(e.target.value)}
                              className="pl-10"
                              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScrape(); } }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">Supports Shopify stores and most e-commerce product pages.</p>
                          {scrapeError && <p className="text-xs text-destructive">{scrapeError}</p>}
                        </div>
                        <Button onClick={handleScrape} disabled={!importUrl.trim() || scrapeProduct.isPending}>
                          {scrapeProduct.isPending ? <><Loader2 className="size-4 animate-spin" />Importing...</> : "Import"}
                        </Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="upload">
                      <div className="pt-2"><ManualUploadForm onSuccess={handleManualUploadSuccess} /></div>
                    </TabsContent>
                  </Tabs>
                )
              ) : confirmedProducts.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {confirmedProducts.map((product) => (
                    <div key={product.id} className="relative">
                      <button onClick={() => store.setProductId(product.id)} className="w-full text-left">
                        <Card className={cn("h-full transition-all", store.productId === product.id ? "border-primary ring-1 ring-primary/30" : "hover:border-muted-foreground/30")}>
                          <CardContent className="flex flex-col gap-3 p-5">
                            <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                              {productImageMap[product.id] ? (
                                <img src={productImageMap[product.id]!} alt={product.name} className="size-full rounded-lg object-cover" loading="lazy" decoding="async" />
                              ) : (
                                <ImageIcon className="size-8 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-medium">{product.name}</h3>
                              {product.price && (
                                <p className="mt-1 font-mono text-sm font-semibold">
                                  {product.currency === "USD" ? "$" : product.currency}{product.price}
                                </p>
                              )}
                            </div>
                            {store.productId === product.id && (
                              <div className="flex items-center gap-1.5 text-xs text-primary">
                                <Check className="size-3.5" />Selected
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </button>
                      <Button asChild size="icon" variant="secondary" className="absolute right-3 top-3 size-8 rounded-full">
                        <Link href={`/products/${product.id}`} onClick={(e) => e.stopPropagation()} aria-label={`Edit ${product.name}`} title="Edit product details and images">
                          <Pencil className="size-3.5" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Product image selector */}
            {selectedProduct && selectedProduct.images.length > 1 && store.productId && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Reference images
                  <span className="text-xs font-normal ml-1.5">
                    ({store.selectedProductImages.length > 0 ? store.selectedProductImages.length : Math.min(selectedProduct.images.length, 4)} of {Math.min(selectedProduct.images.length, 4)} selected)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.images.slice(0, 4).map((imgPath, idx) => {
                    const resolvedUrl = selectedProductAllImages[imgPath];
                    const isSelected = store.selectedProductImages.length === 0 || store.selectedProductImages.includes(imgPath);
                    return (
                      <button
                        key={imgPath}
                        type="button"
                        onClick={() => {
                          const current = store.selectedProductImages.length === 0 ? selectedProduct.images.slice(0, 4) : [...store.selectedProductImages];
                          if (current.includes(imgPath)) {
                            if (current.length <= 1) return;
                            store.setSelectedProductImages(current.filter((p) => p !== imgPath));
                          } else {
                            store.setSelectedProductImages([...current, imgPath]);
                          }
                        }}
                        className={cn("relative size-16 rounded-lg overflow-hidden border-2 transition-all shrink-0", isSelected ? "border-primary ring-1 ring-primary/30" : "border-border opacity-50 hover:opacity-75")}
                      >
                        {resolvedUrl ? (
                          <img src={resolvedUrl} alt={`Product image ${idx + 1}`} className="size-full object-cover" loading="lazy" decoding="async" />
                        ) : (
                          <div className="size-full bg-muted flex items-center justify-center"><ImageIcon className="size-4 text-muted-foreground" /></div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <div className="size-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="size-2.5 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky Continue — Section 1 ── */}
      {!section1Complete && confirmedProducts.length > 0 && !showAddProductForm && !productsLoading && (
        <div className="sticky bottom-4 z-20 flex justify-end pointer-events-none">
          <Button onClick={() => store.setStep(2)} disabled={!store.productId} className="pointer-events-auto shadow-lg">
            Continue <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* ── Section 2: Persona ──────────────────────────────────────────── */}
      {store.step >= 2 && (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0",
                section2Complete ? "bg-primary/15 text-primary" : "bg-primary text-primary-foreground",
              )}>
                {section2Complete ? <Check className="size-3.5" /> : "2"}
              </div>
              <span className="text-sm font-semibold">
                {section2Complete && selectedPersona ? (
                  <span className="flex items-center gap-2">
                    {personaImageMap[selectedPersona.id] && (
                      <img src={personaImageMap[selectedPersona.id]!} alt={selectedPersona.name} className="size-5 rounded-full object-cover" loading="lazy" decoding="async" />
                    )}
                    <span className="text-foreground truncate max-w-[200px] sm:max-w-none">{selectedPersona.name}</span>
                  </span>
                ) : "AI Spokesperson"}
              </span>
            </div>
            {section2Complete && (
              <button type="button" onClick={() => handleOpenSection(2)} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
                Change
              </button>
            )}
          </div>

          {!section2Complete && (
            <div className="px-5 pb-5 flex flex-col gap-4">
              {showPersonaBuilder ? (
                <PersonaBuilderInline
                  onSaved={(id) => {
                    queryClient.invalidateQueries({ queryKey: ["personas"] });
                    store.setPersonaId(id);
                    setBuildingPersona(false);
                    store.setStep(3);
                  }}
                  onCancel={activePersonas.length > 0 ? () => setBuildingPersona(false) : undefined}
                />
              ) : personasLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2].map((i) => <Card key={i} className="h-40 animate-pulse bg-muted" />)}
                </div>
              ) : (
                (() => {
                  const plan = profile?.plan as PlanTier | undefined;
                  const personaLimit = plan && PLANS[plan] ? PLANS[plan].personas : 1;
                  const atLimit = !profileLoading && activePersonas.length >= personaLimit;
                  return (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {activePersonas.map((persona) => {
                        const hasImage = !!(persona.selected_image_url || persona.generated_images?.[0]);
                        return (
                          <button
                            key={persona.id}
                            onClick={() => {
                              if (!hasImage) return;
                              store.setPersonaId(persona.id);
                              store.setStep(3);
                            }}
                            disabled={!hasImage}
                            className={cn("text-left", !hasImage && "cursor-not-allowed opacity-50")}
                          >
                            <Card className={cn("h-full transition-all", store.personaId === persona.id ? "border-primary ring-1 ring-primary/30" : hasImage ? "hover:border-muted-foreground/30" : "")}>
                              <CardContent className="flex flex-col items-center gap-3 p-6">
                                <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                                  {personaImageMap[persona.id] ? (
                                    <img src={personaImageMap[persona.id]!} alt={persona.name} className="size-full rounded-full object-cover" loading="lazy" decoding="async" />
                                  ) : (
                                    <User className="size-8 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="text-center">
                                  <h3 className="font-medium">{persona.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {persona.attributes.gender} / {persona.attributes.age} / {persona.attributes.clothing_style}
                                  </p>
                                </div>
                                {!hasImage ? (
                                  <div className="flex items-center gap-1.5 text-xs text-amber-500">
                                    <AlertCircle className="size-3.5" />Needs image - visit Personas
                                  </div>
                                ) : store.personaId === persona.id ? (
                                  <div className="flex items-center gap-1.5 text-xs text-primary">
                                    <Check className="size-3.5" />Selected
                                  </div>
                                ) : null}
                              </CardContent>
                            </Card>
                          </button>
                        );
                      })}

                      {/* New Persona card */}
                      <button
                        className="text-left"
                        onClick={() => {
                          if (atLimit) {
                            offer.startOffer();
                            setShowPersonaLimitPaywall(true);
                          } else {
                            setBuildingPersona(true);
                          }
                        }}
                      >
                        <Card className="h-full border-dashed transition-all hover:border-muted-foreground/40">
                          <CardContent className="flex flex-col items-center justify-center gap-3 p-6 h-full min-h-[200px]">
                            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                              <Plus className="size-6 text-muted-foreground" />
                            </div>
                            <div className="text-center">
                              <p className="text-sm font-medium">New Persona</p>
                              {atLimit && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {personaLimit}/{personaLimit} used · upgrade to add more
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Section 3: Review & Generate ───────────────────────────────── */}
      {section3Unlocked && (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</div>
            <span className="text-sm font-semibold">Review & Generate</span>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* NanoBananaLoader overlay */}
            {isGenerating && (
              <NanoBananaLoader
                title="Creating Your Video"
                subtitle="This usually takes 1–3 minutes"
                steps={VIDEO_GEN_STEPS}
                currentStep={videoLoaderStep}
                progress={videoLoaderProgress}
                className="min-h-[350px]"
              />
            )}

            {!isGenerating && (
              <>
                {/* Summary: product + persona */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  {selectedProduct && (
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{selectedProduct.name}</span>
                    </div>
                  )}
                  {selectedProduct && selectedPersona && <span className="text-muted-foreground">·</span>}
                  {selectedPersona && (
                    <div className="flex items-center gap-2 min-w-0">
                      {personaImageMap[selectedPersona.id] ? (
                        <img src={personaImageMap[selectedPersona.id]!} alt={selectedPersona.name} className="size-5 rounded-full object-cover shrink-0" />
                      ) : (
                        <User className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium truncate">{selectedPersona.name}</span>
                    </div>
                  )}
                </div>

                {/* CTA style - collapsible */}
                <Collapsible open={ctaOpen} onOpenChange={setCtaOpen}>
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between rounded-xl border-2 border-border px-4 py-3 text-left transition-all hover:border-muted-foreground/30">
                      <p className="text-sm font-medium">Customize CTA</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {CTA_STYLE_OPTIONS.find((o) => o.key === store.ctaStyle)?.label ?? "Auto"}
                        </Badge>
                        {ctaOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      {CTA_STYLE_OPTIONS.filter((o) => o.key === "auto" || o.key === "link_in_bio" || o.key === "direct_website").map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => store.setCtaStyle(option.key)}
                          className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.ctaStyle === option.key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
                        >
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      ))}
                    </div>
                    {showMoreCta && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {CTA_STYLE_OPTIONS.filter((o) => o.key !== "auto" && o.key !== "link_in_bio" && o.key !== "direct_website").map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => store.setCtaStyle(option.key)}
                            className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.ctaStyle === option.key ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
                          >
                            <p className="text-sm font-semibold">{option.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={() => setShowMoreCta(v => !v)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
                      {showMoreCta ? "Fewer CTA options ▲" : "More CTA options ▼"}
                    </button>
                    {requiresCommentKeyword && (
                      <div className="mt-3">
                        <Label htmlFor="cta-comment-keyword" className="text-xs text-muted-foreground">Keyword viewers should comment</Label>
                        <Input
                          id="cta-comment-keyword"
                          value={store.ctaCommentKeyword}
                          onChange={(e) => store.setCtaCommentKeyword(e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""))}
                          placeholder='e.g. "link" or "deal"'
                          className="mt-1"
                          maxLength={30}
                        />
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>

                {/* Mode selector */}
                <div>
                  <p className="mb-2 text-sm font-medium">Generation mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => store.setMode("single")}
                      className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.mode === "single" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
                    >
                      <div className="flex w-full items-center justify-between">
                        <p className="text-sm font-semibold">Single Ad</p>
                        <p className="text-sm font-bold text-primary">{store.quality === "hd" ? CREDITS_PER_SINGLE_HD : CREDITS_PER_SINGLE} cr</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">1 complete video · fastest</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => store.setMode("triple")}
                      className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.mode === "triple" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
                    >
                      <div className="flex w-full items-center justify-between">
                        <p className="text-sm font-semibold">Full Campaign</p>
                        <p className="text-sm font-bold text-primary">{store.quality === "hd" ? CREDITS_PER_BATCH_HD : CREDITS_PER_BATCH} cr</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">27 combos · pick your best</p>
                    </button>
                  </div>
                </div>

                {/* Quality selector */}
                <div>
                  <p className="mb-2 text-sm font-medium">Video quality</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { store.setQuality("standard"); store.setVideoProvider("kling"); }}
                      className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.quality === "standard" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
                    >
                      <p className="text-sm font-semibold">Standard</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Kling 2.6 · Faster, great for testing</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => store.setQuality("hd")}
                      className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.quality === "hd" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}
                    >
                      <p className="text-sm font-semibold">High Quality</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Best quality · final ads</p>
                    </button>
                  </div>
                </div>

                {/* Model sub-selector (HD only) */}
                {store.quality === "hd" && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Model</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => store.setVideoProvider("kling")} className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.videoProvider === "kling" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                        <p className="text-sm font-semibold">Kling 3.0</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Fast · proven quality</p>
                      </button>
                      <button type="button" onClick={() => store.setVideoProvider("sora")} className={cn("flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all", store.videoProvider === "sora" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30")}>
                        <p className="text-sm font-semibold">Sora 2 ✨</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Premium · OpenAI</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Language */}
                <div>
                  <p className="mb-2 text-sm font-medium">Script language</p>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => store.setLanguage(lang.code)}
                        className={cn("rounded-lg border-2 px-3 py-1.5 text-sm transition-all", store.language === lang.code ? "border-primary bg-primary/5 font-medium text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/40")}
                      >
                        {lang.native}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Audio is rendered in English by the AI model. Script language affects the on-screen text only.</p>
                </div>

                {requiresCommentKeyword && !commentKeyword && (
                  <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                    Add a comment keyword above to generate the CTA correctly.
                  </div>
                )}

                {/* Credit cost */}
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    This will use <span className="font-bold text-foreground">{effectiveCost} credits</span>
                    {!isUnlimitedCredits && <span> ({creditsRemaining} remaining)</span>}
                  </p>
                </div>

                {/* Generate button */}
                <Button
                  onClick={handleGenerate}
                  disabled={!store.productId || !store.personaId || creditsLoading || (requiresCommentKeyword && !commentKeyword)}
                  size="lg"
                  className="w-full"
                >
                  {creditsLoading ? (
                    <><Loader2 className="size-4 animate-spin" />Checking credits...</>
                  ) : (
                    <><Zap className="size-4" />Generate Video</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Paywall dialog ─────────────────────────────────────────────── */}
      <Dialog open={showPaywall} onOpenChange={handlePaywallClose}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogTitle className="sr-only">Upgrade to generate videos</DialogTitle>
          <DialogDescription className="sr-only">Choose a plan or credit pack to start generating video ads.</DialogDescription>

          {offer.isActive && (
            <div className="bg-primary text-primary-foreground px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm font-medium shrink-0">
              <div className="flex items-center gap-2">
                <Flame className="size-4 shrink-0" />
                <span>Limited Offer: 50% OFF your first video & 30% OFF all plans.</span>
              </div>
              <div className="flex items-center gap-2 bg-black/15 px-2.5 py-0.5 rounded font-mono">
                <Clock className="size-3 opacity-80" />
                <span className="tabular-nums">{offer.timeDisplay}</span>
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1">
            <div className="text-center max-w-2xl mx-auto pt-6 sm:pt-10 pb-4 sm:pb-6 px-4 sm:px-6">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">{paywallHeadline}</h2>
              <p className="text-muted-foreground font-medium">{paywallSublineStatic ?? "Your next UGC ad is 3 minutes away."}</p>
              <p className="mt-1.5 text-sm text-muted-foreground/80">
                Traditional UGC agencies charge <span className="font-semibold line-through decoration-muted-foreground/40">$150–$500 per video</span>. Get the same quality for <span className="font-semibold text-foreground">as low as $5</span>.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 pb-5 sm:pb-6">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="flex">{[1,2,3,4,5].map(i => <Star key={i} className="size-3 fill-amber-400 text-amber-400" />)}</div>
                <span>Loved by e-commerce brands</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="size-3 text-primary" /><span>Ready in under 5 minutes</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Check className="size-3 text-emerald-500" /><span>No filming or editing required</span>
              </div>
            </div>

            <div className="flex justify-center mb-6 sm:mb-8 px-4">
              <div className="bg-muted/80 p-1 sm:p-1.5 rounded-full inline-flex border border-border shadow-sm">
                <button type="button" onClick={() => setPaywallTab("single")} className={cn("px-4 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all duration-200", paywallTab === "single" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
                  <>
                    {store.quality === "hd" ? "1 HD Video" : "1 Standard Video"}
                    {isFirstVideo && <span className="ml-1 sm:ml-2 text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">-50%</span>}
                  </>
                </button>
                <button type="button" onClick={() => setPaywallTab("subscription")} className={cn("flex items-center gap-1 sm:gap-2 px-4 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all duration-200", paywallTab === "subscription" ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground")}>
                  Subscribe & Save
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold", paywallTab === "subscription" ? "bg-primary/10 text-primary" : "bg-muted-foreground/20 text-muted-foreground")}>-30%</span>
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-6 sm:pb-10">
              {paywallTab === "single" ? (
                <div className="max-w-md mx-auto bg-card p-8 rounded-2xl border border-border shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-1">Single Video</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">Experience the quality before committing.</p>
                  </div>
                  <div className="mb-6">
                    <div className="w-full p-5 rounded-2xl border-2 border-primary bg-primary/5 text-left">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full border border-primary flex items-center justify-center shrink-0">
                            <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                          </div>
                          {store.quality === "hd" ? (
                            <div><span className="font-semibold text-foreground">Kling 3.0 · HD</span><span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Best Quality</span></div>
                          ) : (
                            <span className="font-semibold text-foreground">Kling 2.6 · Standard</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isFirstVideo && <span className="text-sm text-muted-foreground line-through font-medium">${store.quality === "hd" ? `${CREDITS_PER_SINGLE_HD}.00` : `${CREDITS_PER_SINGLE}.00`}</span>}
                          <span className="font-bold text-foreground text-lg">
                            ${store.quality === "hd"
                              ? (isFirstVideo ? (CREDITS_PER_SINGLE_HD / 2).toFixed(2) : `${CREDITS_PER_SINGLE_HD}.00`)
                              : (isFirstVideo ? (CREDITS_PER_SINGLE / 2).toFixed(2) : `${CREDITS_PER_SINGLE}.00`)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full py-6 text-base font-bold" onClick={() => handleBuyPack(store.quality === "hd" ? "single_hd" : "single_standard")} disabled={buyCredits.isPending}>
                    {buyCredits.isPending ? <Loader2 className="size-4 animate-spin" /> : "Generate Video →"}
                  </Button>
                  {videosGenerated === 0 && isFirstVideo && (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">First video: 50% OFF applied automatically</span>
                    </div>
                  )}
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    Buying {store.quality === "hd" ? "10" : "5"} credits · Unused credits carry over for future videos
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
                  {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(([key, plan]) => {
                    const isGrowth = key === "growth";
                    const discountedMonthly = offer.discountedPrice(plan.price);
                    return (
                      <div key={key} className={cn("bg-card rounded-2xl p-7 relative flex flex-col", isGrowth ? "border-2 border-primary shadow-lg" : "border border-border shadow-sm")}>
                        {isGrowth && (
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm whitespace-nowrap">
                            Most Popular
                          </div>
                        )}
                        <div className="mb-4">
                          <h3 className="text-lg font-bold text-foreground capitalize">{key}</h3>
                          <div className="mt-2 flex items-baseline gap-1">
                            {offer.isActive && <span className="text-sm text-muted-foreground line-through">${plan.price}</span>}
                            <span className="text-3xl font-extrabold text-foreground">${discountedMonthly}</span>
                            <span className="text-sm text-muted-foreground">/mo</span>
                          </div>
                        </div>
                        <ul className="mb-6 flex flex-col gap-2 flex-1">
                          {PLAN_BENEFITS[key].map((benefit) => (
                            <li key={benefit} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Check className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                        <Button onClick={() => handleCheckout(key)} disabled={checkout.isPending} className={cn("w-full", isGrowth ? "" : "variant-outline")}>
                          {checkout.isPending ? <Loader2 className="size-4 animate-spin" /> : `Get ${key.charAt(0).toUpperCase() + key.slice(1)}`}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Persona limit paywall dialog ──────────────────────────────── */}
      <Dialog open={showPersonaLimitPaywall} onOpenChange={setShowPersonaLimitPaywall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Persona limit reached</DialogTitle>
            <DialogDescription>
              Upgrade your plan to create more personas and unlock additional features.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowPersonaLimitPaywall(false)}>Cancel</Button>
            <Button onClick={() => { setShowPersonaLimitPaywall(false); setShowPaywall(true); setPaywallTab("subscription"); }}>
              Upgrade Plan
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
