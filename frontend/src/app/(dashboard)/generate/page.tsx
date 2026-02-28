"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  Monitor,
  Package,
  RefreshCw,
  Smartphone,
  User,
  Zap,
  LinkIcon,
  Upload,
  Plus,
  Pencil,
  Sparkles,
  TrendingUp,
  Star,
  Clock,
  Flame,
  AlertCircle,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useFirstPurchaseOffer, COUPON_30_OFF } from "@/hooks/use-first-purchase-offer";
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
} from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { isExternalUrl, getSignedImageUrl } from "@/lib/storage";
import { usePersonas, resolvePersonaImageUrl } from "@/hooks/use-personas";
import type { Persona, Product, BrandSummary, ScriptSegment } from "@/types/database";
import { useCredits } from "@/hooks/use-credits";
import {
  useEditCompositeImage,
  useGenerateCompositeImages,
  useGenerateScript,
  useApproveAndGenerate,
} from "@/hooks/use-generations";
import { useCheckout, useBuyCredits } from "@/hooks/use-checkout";
import { useProfile } from "@/hooks/use-profile";
import { ManualUploadForm } from "@/components/products/ManualUploadForm";
import { ScrapeResults } from "@/components/products/ScrapeResults";
import {
  trackProductImported,
  trackPreviewGenerated,
  trackScriptGenerated,
  trackVideoGenerationStarted,
  trackPaywallShown,
  trackCheckoutStarted,
  trackCreditsPurchased,
} from "@/lib/datafast";
import { AdvancedModePanel } from "@/components/generate/AdvancedModePanel";
import { Switch } from "@/components/ui/switch";
import { callEdge } from "@/lib/api";
import type { GenerateSegmentScriptResponse } from "@/types/api";
import type { AdvancedSegmentConfig, AdvancedSegmentsConfig } from "@/types/database";

const steps = [
  { number: 1, label: "Product" },
  { number: 2, label: "Persona" },
  { number: 3, label: "Preview" },
  { number: 4, label: "Configure" },
  { number: 5, label: "Review Script" },
];

const CTA_STYLE_OPTIONS = [
  {
    key: "auto",
    label: "Auto",
    description: "Mixes CTA styles for variety",
    example: "Varies each video",
  },
  {
    key: "product_name_drop",
    label: "Name Drop",
    description: "Mentions the product name directly",
    example: 'Video ends: "Get [Product Name] now"',
  },
  {
    key: "link_in_bio",
    label: "Link in Bio",
    description: "Directs viewers to your bio link",
    example: 'Video ends: "Link in bio!"',
  },
  {
    key: "comment_keyword",
    label: "Comment Keyword",
    description: "Triggers automation (e.g. ManyChat)",
    example: 'Video ends: "Comment FREE"',
  },
  {
    key: "direct_website",
    label: "Direct Website",
    description: "Shows your store URL on screen",
    example: "Video ends with your store URL",
  },
  {
    key: "discount_code",
    label: "Discount Code",
    description: "Highlights a promo code on screen",
    example: 'Video ends: "Use code SAVE20"',
  },
  {
    key: "link_in_comments",
    label: "Link in Comments",
    description: "Directs viewers to comments",
    example: 'Video ends: "Tap the comments for the link"',
  },
  {
    key: "check_description",
    label: "Check Description",
    description: "Points to the caption/description",
    example: 'Video ends: "Full details in caption"',
  },
] as const;

const VARIANT_LABEL_MAP: Record<string, string> = {
  direct_address: "Direct Appeal",
  value_prop: "Value Prop",
  urgency: "Urgency",
  fomo: "FOMO",
  problem_solution: "Problem \u2192 Solution",
  storytelling: "Story",
  social_proof: "Social Proof",
  question: "Question Hook",
  bold_claim: "Bold Claim",
  hook: "Hook",
  body: "Body",
  cta: "CTA",
};

function formatVariantLabel(label: string): string {
  return VARIANT_LABEL_MAP[label] ?? label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function useResolvedProductImages(
  products: { id: string; images: string[] }[] | undefined,
) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!products || products.length === 0) return;
    let cancelled = false;
    async function resolve() {
      const entries = await Promise.all(
        products!.map(async (p) => {
          const raw = p.images?.[0];
          if (!raw) return [p.id, null] as [string, null];
          const url = isExternalUrl(raw)
            ? raw
            : await getSignedImageUrl("product-images", raw);
          return [p.id, url] as [string, string | null];
        }),
      );
      if (!cancelled) setImageMap(Object.fromEntries(entries));
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [products]);

  return imageMap;
}

function useResolvedPersonaImages(personas: Persona[] | undefined) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!personas || personas.length === 0) return;
    let cancelled = false;
    async function resolve() {
      const entries = await Promise.all(
        personas!.map(async (p) => {
          // Try selected_image_url first, fall back to first generated image
          const raw = p.selected_image_url ?? p.generated_images?.[0] ?? null;
          const url = await resolvePersonaImageUrl(raw);
          return [p.id, url] as [string, string | null];
        }),
      );
      if (!cancelled) setImageMap(Object.fromEntries(entries));
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [personas]);

  return imageMap;
}

export default function GeneratePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const store = useGenerationWizardStore();
  const [showPaywall, setShowPaywall] = useState(false);

  // Validate persisted pendingGenerationId against DB on mount.
  // If the generation no longer exists or moved past awaiting_approval, clear stale script.
  useEffect(() => {
    if (!store.pendingGenerationId) return;
    const supabase = createClient();
    supabase
      .from("generations")
      .select("status")
      .eq("id", store.pendingGenerationId)
      .single()
      .then(({ data }) => {
        if (!data || data.status !== "awaiting_approval") {
          store.clearPendingScript();
          if (store.step === 5) store.setStep(4);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 1, product add state
  const [addingProduct, setAddingProduct] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] =
    useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);

  // Step 2, persona builder state (tab removed — persona creation is now a separate page)

  // Step 3, composite preview state
  const [compositeImages, setCompositeImages] = useState<
    Array<{ path: string; signed_url: string }>
  >([]);
  const [selectedCompositeIdx, setSelectedCompositeIdx] = useState<number | null>(null);
  const [showPreviewEditor, setShowPreviewEditor] = useState(false);
  const [previewEditPrompt, setPreviewEditPrompt] = useState("");

  // Step 4, advanced mode state
  const [isInitializingAdvanced, setIsInitializingAdvanced] = useState(false);

  // Tracks which format was used to fire background composite generation
  const generationFiredForFormat = useRef<string | null>(null);
  // Cancellation token for auto-fired script generation — incremented on each
  // composite select so stale onSuccess callbacks from previous selections are discarded
  const scriptAutoFireToken = useRef(0);

  // Step 4, rendering timeline collapsible
  const [showTimeline, setShowTimeline] = useState(false);
  // Tracks whether config changed after auto-fired script (enables "Regenerate with new settings")
  const [scriptConfigChanged, setScriptConfigChanged] = useState(false);

  // Auto-fire composites when arriving at step 3 via localStorage restore
  // (handleNext sets the ref before advancing, so this only fires for cold restores)
  useEffect(() => {
    if (
      store.step === 3 &&
      compositeImages.length === 0 &&
      !generateComposites.isPending &&
      !generationFiredForFormat.current &&
      store.productId &&
      store.personaId &&
      store.format
    ) {
      handleGenerateComposites();
      generationFiredForFormat.current = store.format;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.step]);

  // Step 5, collapsible alt variants
  const [showAltHooks, setShowAltHooks] = useState(false);
  const [showAltBodies, setShowAltBodies] = useState(false);
  const [showAltCtas, setShowAltCtas] = useState(false);
  const [showInlinePaywall, setShowInlinePaywall] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const productImageMap = useResolvedProductImages(products);
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const personaImageMap = useResolvedPersonaImages(personas);
  const scrapeProduct = useScrapeProduct();
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile } = useProfile();
  const generateComposites = useGenerateCompositeImages();
  const editComposite = useEditCompositeImage();

  // Step 3 cycling progress messages while composites generate
  const COMPOSITE_MESSAGES = [
    "Placing your persona in the scene...",
    "Compositing product and persona...",
    "Rendering lighting and style...",
    "Finalising preview images...",
    "Almost ready...",
  ];
  const [compositeMsgIdx, setCompositeMsgIdx] = useState(0);
  useEffect(() => {
    if (!generateComposites.isPending) { setCompositeMsgIdx(0); return; }
    const id = setInterval(() => setCompositeMsgIdx((i) => (i + 1) % COMPOSITE_MESSAGES.length), 2800);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateComposites.isPending]);
  const generateScript = useGenerateScript();
  const approveAndGenerate = useApproveAndGenerate();
  const watchedGenerationsStore = useWatchedGenerationsStore();
  const checkout = useCheckout();
  const buyCredits = useBuyCredits();
  const offer = useFirstPurchaseOffer();

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const activePersonas = personas ?? [];

  const selectedProduct = confirmedProducts.find(
    (p) => p.id === store.productId,
  );
  const selectedPersona = activePersonas.find((p) => p.id === store.personaId);

  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const creditCost =
    store.quality === "hd"
      ? store.mode === "single"
        ? CREDITS_PER_SINGLE_HD
        : CREDITS_PER_BATCH_HD
      : store.mode === "single"
        ? CREDITS_PER_SINGLE
        : CREDITS_PER_BATCH;

  // First-video 50% discount for new users
  const isFirstVideo = profile?.first_video_discount_used === false;
  const effectiveCost = isFirstVideo ? Math.floor(creditCost / 2) : creditCost;

  const hasEnoughCredits = creditsLoading || isUnlimitedCredits || creditsRemaining >= effectiveCost;
  const requiresCommentKeyword = store.ctaStyle === "comment_keyword";
  const commentKeyword = store.ctaCommentKeyword
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, "");

  // Derived view states, no effects needed
  const showAddProductForm =
    addingProduct || (!productsLoading && confirmedProducts.length === 0);

  function canProceed() {
    if (store.step === 1) return !!store.productId && !!store.format;
    if (store.step === 2) return !!store.personaId;
    if (store.step === 3) return !!store.compositeImagePath;
    // Step 4 proceeds via "Generate Script" button, not the generic Next button
    return false;
  }

  function handleNext() {
    if (store.step === 2) {
      // Fire composites in background only if not already pending and not already
      // generated for this format. generationFiredForFormat tracks the format used
      // for the last fire; it is reset to null in handleBack so going back+forward
      // always re-generates, but a double-tap or re-render cannot double-fire.
      const alreadyFired =
        generationFiredForFormat.current === store.format;
      if (!generateComposites.isPending && (!compositeImages.length || !alreadyFired)) {
        handleGenerateComposites();
        generationFiredForFormat.current = store.format;
      }
    }
    if (store.step < 5) store.setStep(store.step + 1);
  }

  function handleBack() {
    if (store.step === 3) {
      setCompositeImages([]);
      store.setCompositeImagePath(null);
      generationFiredForFormat.current = null;
    }
    if (store.step > 1) store.setStep(store.step - 1);
  }

  // ── Product import handlers ──────────────────────────────────────────────

  async function handleScrape() {
    if (!importUrl.trim()) return;
    setScrapeError(null);
    try {
      const result = await scrapeProduct.mutateAsync({ url: importUrl.trim() });
      if (result.products.length === 0) {
        if (result.blocked_by_robots) {
          throw new Error(
            "This store blocks automated scraping (robots.txt). Try manual upload.",
          );
        }
        throw new Error(
          "No products could be extracted from this URL. Try a direct product page.",
        );
      }
      if (result.save_failed) {
        const detail = result.save_error ? ` (${result.save_error})` : "";
        throw new Error(
          `We scraped this page but could not save products to your account. Please try again.${detail}`,
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
      if (scraped.length === 0) {
        throw new Error(
          "Products were found but none were saved to your account. Please try again.",
        );
      }
      setScrapedProducts(scraped);
      setScrapedBrandSummary(result.brand_summary ?? null);
      setShowScrapeResults(true);
      setImportUrl("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to import product";
      setScrapeError(message);
      toast.error(
        message,
        { action: { label: "Retry", onClick: handleScrape } },
      );
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
      // Stay on Step 1 — user must pick a format before proceeding (format picker is in Step 1)
    }
    toast.success("Products imported! Choose a format to continue.");
  }

  function handleManualUploadSuccess() {
    trackProductImported("manual");
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setAddingProduct(false);
    // Don't auto-advance, user needs to click their product in the grid
  }

  function handleCancelAddProduct() {
    setAddingProduct(false);
    setShowScrapeResults(false);
    setScrapedProducts([]);
    setScrapedBrandSummary(null);
    setImportUrl("");
    setScrapeError(null);
  }

  // ── Composite preview handlers ───────────────────────────────────────────

  function handleFormatChange(format: "9:16" | "16:9") {
    store.setFormat(format);
    // Clear composites and auto-regenerate with new format.
    // Pass format explicitly to avoid stale store.format in the same call stack.
    setCompositeImages([]);
    setSelectedCompositeIdx(null);
    setShowPreviewEditor(false);
    store.setCompositeImagePath(null);
    setPreviewEditPrompt("");
    generationFiredForFormat.current = format;
    handleGenerateComposites(format);
  }

  async function handleGenerateComposites(formatOverride?: "9:16" | "16:9", personaIdOverride?: string) {
    const format = formatOverride ?? store.format;
    const personaId = personaIdOverride ?? store.personaId;
    if (!store.productId || !personaId || !format) return;
    setCompositeImages([]);
    setSelectedCompositeIdx(null);
    setShowPreviewEditor(false);
    store.setCompositeImagePath(null);
    setPreviewEditPrompt("");

    generateComposites.mutate(
      { product_id: store.productId, persona_id: personaId, format },
      {
        onSuccess: (result) => {
          setCompositeImages(result.images);
          trackPreviewGenerated();
        },
        onError: (err) => {
          toast.error(err.message || "Failed to generate preview images");
        },
      },
    );
  }

  function handleSelectComposite(idx: number) {
    setSelectedCompositeIdx(idx);
    setShowPreviewEditor(false);
    const path = compositeImages[idx].path;
    store.setCompositeImagePath(path);
    // Auto-fire script so it's ready (or nearly ready) when user reaches Step 4.
    // Increment the token so any in-flight onSuccess for a previous composite is discarded.
    const token = ++scriptAutoFireToken.current;
    if (store.productId && store.personaId) {
      // Skip auto-fire if comment keyword CTA is selected but keyword is empty
      if (store.ctaStyle === "comment_keyword" && !store.ctaCommentKeyword.trim()) return;
      store.clearPendingScript();
      setScriptConfigChanged(false);
      generateScript.mutate(
        {
          product_id: store.productId,
          persona_id: store.personaId,
          mode: store.mode,
          quality: store.quality,
          composite_image_path: path,
          cta_style: store.ctaStyle,
          phase: "script",
        },
        {
          onSuccess: (result) => {
            // Discard if user already selected a different composite
            if (scriptAutoFireToken.current !== token) return;
            if (result.script) {
              trackScriptGenerated(store.mode, store.quality);
              store.setPendingScript(
                result.generation_id,
                result.script,
                result.credits_to_charge ?? effectiveCost,
              );
            }
          },
          onError: () => {
            // Silent fail — user can manually generate script in Step 4
          },
        },
      );
    }
  }

  function handleApplyPreviewEdit() {
    const trimmedPrompt = previewEditPrompt.trim();
    if (!store.compositeImagePath || !trimmedPrompt) return;

    editComposite.mutate(
      {
        composite_image_path: store.compositeImagePath,
        edit_prompt: trimmedPrompt,
        format: store.format!,
      },
      {
        onSuccess: (result) => {
          setCompositeImages((prev) => [result.image, ...prev]);
          setSelectedCompositeIdx(0);
          setShowPreviewEditor(false);
          store.setCompositeImagePath(result.image.path);
          setPreviewEditPrompt("");
          toast.success("Preview image updated");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to edit preview image");
        },
      },
    );
  }

  // ── Script generation (phase 1) ─────────────────────────────────────────

  async function handleGenerateScript() {
    if (requiresCommentKeyword && !commentKeyword) {
      toast.error("Add a comment keyword for the CTA style.");
      return;
    }
    if (!store.productId || !store.personaId || !store.compositeImagePath) return;
    setScriptConfigChanged(false);

    generateScript.mutate(
      {
        product_id: store.productId,
        persona_id: store.personaId,
        mode: store.mode,
        quality: store.quality,
        composite_image_path: store.compositeImagePath,
        cta_style: store.ctaStyle,
        cta_comment_keyword: requiresCommentKeyword ? commentKeyword : undefined,
        phase: "script",
      },
      {
        onSuccess: (result) => {
          if (result.script) {
            trackScriptGenerated(store.mode, store.quality);
            store.setPendingScript(
              result.generation_id,
              result.script,
              result.credits_to_charge ?? effectiveCost,
            );
            store.setStep(5);
          } else {
            toast.error("Script was not returned. Please try again.");
          }
        },
        onError: (err) => {
          toast.error(err.message || "Failed to generate script");
        },
      },
    );
  }

  // ── Approve & generate video (phase 2) ────────────────────────────────

  async function handleApproveAndGenerate() {
    if (!store.pendingGenerationId || !store.pendingScript) return;
    if (!hasEnoughCredits) {
      trackPaywallShown("insufficient_credits");
      offer.startOffer();
      setShowInlinePaywall(true);
      setShowPaywall(true);
      return;
    }

    approveAndGenerate.mutate(
      {
        generation_id: store.pendingGenerationId,
        override_script: store.pendingScript,
      },
      {
        onSuccess: (result) => {
          const genId = store.pendingGenerationId!;
          trackVideoGenerationStarted(store.mode, store.quality);
          watchedGenerationsStore.add(genId, selectedProduct?.name);
          store.reset();
          router.push(`/generate/${genId}`);
          toast.success("Generation started!");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to start generation");
        },
      },
    );
  }

  function handleAdvancedModeToggle(enabled: boolean) {
    store.setAdvancedMode(enabled);
  }

  async function handleInitializeAdvancedSegments() {
    if (!store.productId || !store.personaId) return;

    setIsInitializingAdvanced(true);
    const variantCount = store.mode === "single" ? 1 : 3;
    const segTypes = ["hook", "body", "cta"] as const;

    // Fire variantCount × 3 parallel calls
    const calls = Array.from({ length: variantCount }, (_, vi) =>
      segTypes.map((segType) =>
        callEdge<GenerateSegmentScriptResponse>("generate-segment-script", {
          body: {
            product_id: store.productId,
            persona_id: store.personaId,
            segment_type: segType,
            variant_index: vi,
            cta_style: store.ctaStyle !== "auto" ? store.ctaStyle : undefined,
            cta_comment_keyword: store.ctaStyle === "comment_keyword" ? store.ctaCommentKeyword : undefined,
          },
        }).then((res) => ({ ok: true as const, text: res.data.text, variantIndex: vi, segType }))
        .catch(() => ({ ok: false as const, text: "", variantIndex: vi, segType }))
      )
    ).flat();

    const results = await Promise.allSettled(calls);

    const defaultSeg = (): AdvancedSegmentConfig => ({
      scriptText: "",
      globalEmotion: "neutral",
      globalIntensity: 2,
      actionDescription: "",
      imagePath: null,
      imageSignedUrl: null,
      isRegeneratingImage: false,
    });

    const hooks: AdvancedSegmentConfig[] = Array.from({ length: variantCount }, defaultSeg);
    const bodies: AdvancedSegmentConfig[] = Array.from({ length: variantCount }, defaultSeg);
    const ctas: AdvancedSegmentConfig[] = Array.from({ length: variantCount }, defaultSeg);

    for (const settled of results) {
      if (settled.status !== "fulfilled") continue;
      const r = settled.value;
      if (!r.ok) continue;
      if (r.segType === "hook") hooks[r.variantIndex] = { ...defaultSeg(), scriptText: r.text };
      if (r.segType === "body") bodies[r.variantIndex] = { ...defaultSeg(), scriptText: r.text };
      if (r.segType === "cta") ctas[r.variantIndex] = { ...defaultSeg(), scriptText: r.text };
    }

    const segments: AdvancedSegmentsConfig = { hooks, bodies, ctas };
    store.setAdvancedSegments(segments);
    setIsInitializingAdvanced(false);
  }

  async function handleCheckout(plan: PlanTier) {
    const couponId = offer.isActive ? COUPON_30_OFF : undefined;
    checkout.mutate({ plan, couponId }, {
      onSuccess: (url) => {
        trackCheckoutStarted(plan);
        if (couponId) offer.markUsed();
        window.location.href = url;
      },
      onError: (err) => { toast.error(err.message || "Failed to start checkout"); },
    });
  }

  async function handleBuyPack(pack: CreditPackKey) {
    const couponId = offer.isActive ? COUPON_30_OFF : undefined;
    buyCredits.mutate({ pack, couponId }, {
      onSuccess: (url) => {
        trackCreditsPurchased(pack);
        if (couponId) offer.markUsed();
        window.location.href = url;
      },
      onError: (err) => { toast.error(err.message || "Failed to start checkout"); },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Generate UGC Video
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create AI-powered video ads in a few simple steps.
            {!creditsLoading && (
              <span className="ml-2 font-medium text-foreground">
                {isUnlimitedCredits
                  ? "Unlimited credits"
                  : `${creditsRemaining} credits remaining`}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => {
                // Allow going back to earlier steps, but when leaving step 5, clear pending script
                if (s.number < store.step) {
                  if (store.step === 5 && s.number < 5) {
                    store.clearPendingScript();
                  }
                  store.setStep(s.number);
                }
              }}
              className="flex items-center gap-2"
            >
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  store.step === s.number
                    ? "bg-primary text-primary-foreground"
                    : store.step > s.number
                      ? "bg-primary/20 text-primary"
                      : "bg-card text-muted-foreground",
                )}
              >
                {store.step > s.number ? (
                  <Check className="size-4" />
                ) : (
                  s.number
                )}
              </div>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  store.step === s.number
                    ? "text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-10",
                  store.step > s.number ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* ── Step 1: Product ───────────────────────────────────────────── */}
        {store.step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Select a Product</h2>
              {!showAddProductForm && confirmedProducts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingProduct(true)}
                >
                  <Plus className="size-4" />
                  Add Product
                </Button>
              )}
              {showAddProductForm && confirmedProducts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelAddProduct}
                >
                  ← Back to products
                </Button>
              )}
            </div>

            {productsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            ) : showAddProductForm ? (
              /* Inline add-product form */
              showScrapeResults && scrapedProducts.length > 0 ? (
                <ScrapeResults
                  products={scrapedProducts}
                  brandSummary={scrapedBrandSummary}
                  onConfirmed={handleScrapeConfirmed}
                />
              ) : (
                <Tabs defaultValue="import-url" className="w-full">
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
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleScrape();
                              }
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Supports Shopify stores and most e-commerce product
                          pages.
                        </p>
                        {scrapeError && (
                          <p className="text-xs text-destructive">{scrapeError}</p>
                        )}
                      </div>
                      <Button
                        onClick={handleScrape}
                        disabled={
                          !importUrl.trim() || scrapeProduct.isPending
                        }
                      >
                        {scrapeProduct.isPending ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          "Import"
                        )}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="upload">
                    <div className="pt-2">
                      <ManualUploadForm
                        onSuccess={handleManualUploadSuccess}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              )
            ) : confirmedProducts.length > 0 ? (
              <>
              {/* Product grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {confirmedProducts.map((product) => (
                  <div key={product.id} className="relative">
                    <button
                      onClick={() => store.setProductId(product.id)}
                      className="w-full text-left"
                    >
                      <Card
                        className={cn(
                          "h-full transition-all",
                          store.productId === product.id
                            ? "border-primary ring-1 ring-primary/30"
                            : "hover:border-muted-foreground/30",
                        )}
                      >
                        <CardContent className="flex flex-col gap-3 p-5">
                          <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                            {productImageMap[product.id] ? (
                              <img
                                src={productImageMap[product.id]!}
                                alt={product.name}
                                className="size-full rounded-lg object-cover"
                              />
                            ) : (
                              <ImageIcon className="size-8 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-medium">{product.name}</h3>
                            {product.price && (
                              <p className="mt-1 font-mono text-sm font-semibold">
                                {product.currency === "USD"
                                  ? "$"
                                  : product.currency}
                                {product.price}
                              </p>
                            )}
                          </div>
                          {store.productId === product.id && (
                            <div className="flex items-center gap-1.5 text-xs text-primary">
                              <Check className="size-3.5" />
                              Selected
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </button>
                    <Button
                      asChild
                      size="icon"
                      variant="secondary"
                      className="absolute right-3 top-3 size-8 rounded-full"
                    >
                      <Link
                        href={`/products/${product.id}`}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Edit ${product.name}`}
                        title="Edit product details and images"
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
              {/* Format picker — choose before proceeding */}
              <div>
                <p className="mb-2 text-sm font-medium">Video format</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => store.setFormat("9:16")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all",
                      store.format === "9:16"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                    )}
                  >
                    <Smartphone className="size-4 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">Portrait</p>
                      <p className="text-xs text-muted-foreground">9:16 · TikTok · Reels</p>
                    </div>
                    {store.format === "9:16" && <Check className="ml-1 size-3.5 text-primary" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => store.setFormat("16:9")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border-2 px-4 py-3 transition-all",
                      store.format === "16:9"
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                    )}
                  >
                    <Monitor className="size-4 shrink-0" />
                    <div className="text-left">
                      <p className="text-sm font-semibold">Landscape</p>
                      <p className="text-xs text-muted-foreground">16:9 · YouTube · Ads</p>
                    </div>
                    {store.format === "16:9" && <Check className="ml-1 size-3.5 text-primary" />}
                  </button>
                </div>
              </div>
              </>
            ) : null}
          </div>
        )}

        {/* ── Step 2: Persona ───────────────────────────────────────────── */}
        {store.step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Select a Persona</h2>

            {personasLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            ) : activePersonas.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activePersonas.map((persona) => {
                  const hasImage = !!(persona.selected_image_url || persona.generated_images?.[0]);
                  return (
                  <button
                    key={persona.id}
                    onClick={() => {
                      if (!hasImage) return;
                      store.setPersonaId(persona.id);
                      handleGenerateComposites(undefined, persona.id);
                      generationFiredForFormat.current = store.format;
                    }}
                    disabled={!hasImage}
                    className={cn("text-left", !hasImage && "cursor-not-allowed opacity-50")}
                  >
                    <Card
                      className={cn(
                        "h-full transition-all",
                        store.personaId === persona.id
                          ? "border-primary ring-1 ring-primary/30"
                          : hasImage
                          ? "hover:border-muted-foreground/30"
                          : "",
                      )}
                    >
                      <CardContent className="flex flex-col items-center gap-3 p-6">
                        <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                          {personaImageMap[persona.id] ? (
                            <img
                              src={personaImageMap[persona.id]!}
                              alt={persona.name}
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            <User className="size-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-center">
                          <h3 className="font-medium">{persona.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {persona.attributes.gender} /{" "}
                            {persona.attributes.age} /{" "}
                            {persona.attributes.clothing_style}
                          </p>
                        </div>
                        {!hasImage ? (
                          <div className="flex items-center gap-1.5 text-xs text-amber-500">
                            <AlertCircle className="size-3.5" />
                            Needs image — visit Personas
                          </div>
                        ) : store.personaId === persona.id ? (
                          <div className="flex items-center gap-1.5 text-xs text-primary">
                            <Check className="size-3.5" />
                            Selected
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </button>
                  );
                })}
              </div>
            ) : (
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center gap-3 py-10">
                  <User className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No personas yet — create one first before generating a video.
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/personas/new?returnTo=/generate">
                      Create your first persona →
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Step 3: Preview ───────────────────────────────────────────── */}
        {store.step === 3 && (
          <div className="flex flex-col gap-6">
            {compositeImages.length === 0 ? (
              /* ── Before generation: compact toggle + skeleton while pending, fallback otherwise ── */
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-semibold">Preview your scene</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your scene images are being prepared. Change format below if needed.
                  </p>
                </div>

                {/* Compact format toggle — always visible so user can change if needed */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Format:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormatChange("9:16")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all",
                        store.format === "9:16"
                          ? "border-primary bg-primary/5 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      <Smartphone className="size-3.5" />
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormatChange("16:9")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all",
                        store.format === "16:9"
                          ? "border-primary bg-primary/5 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      <Monitor className="size-3.5" />
                      Landscape
                    </button>
                  </div>
                </div>

                {generateComposites.isPending ? (
                  <div className="flex flex-col items-center gap-6 py-6">
                    {/* Central animated indicator */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10">
                        <Sparkles className="size-7 animate-pulse text-primary" />
                        <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">Generating preview</p>
                        <p className="mt-0.5 text-xs text-muted-foreground transition-all duration-500">
                          {COMPOSITE_MESSAGES[compositeMsgIdx]}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground/60">~20 seconds</p>
                      </div>
                    </div>
                    {/* Skeleton cards */}
                    <div className="grid w-full grid-cols-4 gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "relative overflow-hidden rounded-xl bg-muted",
                            (store.format ?? "9:16") === "9:16" ? "aspect-[9/16]" : "aspect-video",
                          )}
                        >
                          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-primary/5 to-muted" style={{ animationDelay: `${i * 200}ms` }} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-5 animate-spin text-primary/25" style={{ animationDelay: `${i * 150}ms` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateComposites()}
                    disabled={!store.productId || !store.personaId || !store.format}
                  >
                    <ImageIcon className="mr-2 size-4" />
                    Generate Preview
                  </Button>
                )}
              </div>
            ) : (
              /* ── After generation: compact controls + full-width image grid ── */
              <div className="flex flex-col gap-4">
                {/* Compact header bar */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Format:</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormatChange("9:16")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all",
                        store.format === "9:16"
                          ? "border-primary bg-primary/5 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      <Smartphone className="size-3.5" />
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormatChange("16:9")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-all",
                        store.format === "16:9"
                          ? "border-primary bg-primary/5 font-medium text-primary"
                          : "border-border text-muted-foreground hover:border-muted-foreground/40",
                      )}
                    >
                      <Monitor className="size-3.5" />
                      Landscape
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateComposites()}
                    disabled={generateComposites.isPending}
                    className="ml-auto"
                  >
                    {generateComposites.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Regenerate
                  </Button>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">
                    Click an image to select it — this becomes the base for your video.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select an image, then use Quick Edit to adjust outfit, background, or lighting
                  </p>
                </div>

                {/* Full-width image grid: 4-col for portrait (tall), 2-col for landscape (wide) */}
                <div className={cn(
                  "grid gap-3",
                  store.format === "9:16" ? "grid-cols-4" : "grid-cols-2",
                )}>
                  {compositeImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectComposite(i)}
                      className="group relative overflow-hidden rounded-xl focus:outline-none"
                    >
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-xl border-2 transition-all",
                          store.format === "9:16" ? "aspect-[9/16]" : "aspect-video",
                          selectedCompositeIdx === i
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent group-hover:border-muted-foreground/40",
                        )}
                      >
                        <img
                          src={img.signed_url}
                          alt={`Preview ${i + 1}`}
                          className="size-full object-cover"
                        />
                        {selectedCompositeIdx === i && (
                          <div className="absolute inset-0 flex items-end justify-center bg-primary/10 pb-3">
                            <div className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                              <Check className="size-3" />
                              Selected
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {selectedCompositeIdx !== null && compositeImages[selectedCompositeIdx] && (
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Quick edit (optional)</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Adjust the selected preview before generating your videos.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreviewEditor((prev) => !prev)}
                      >
                        <Sparkles className="size-3.5" />
                        {showPreviewEditor ? "Hide Edit" : "Edit Selected"}
                      </Button>
                    </div>

                    {showPreviewEditor && (
                      <div className="mt-3 flex flex-col gap-3">
                        <Textarea
                          id="preview-edit-prompt"
                          value={previewEditPrompt}
                          onChange={(e) => setPreviewEditPrompt(e.target.value)}
                          placeholder="Example: Change the outfit to a black hoodie and make the background a cozy cafe at sunset."
                          maxLength={500}
                        />

                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            Uses the selected preview image as the reference.
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowPreviewEditor(false)}
                              disabled={editComposite.isPending}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleApplyPreviewEdit}
                              disabled={
                                editComposite.isPending ||
                                !store.compositeImagePath ||
                                previewEditPrompt.trim().length === 0
                              }
                            >
                              {editComposite.isPending ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  Applying Edit...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="size-3.5" />
                                  Apply Edit
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Configure ──────────────────────────────────────────── */}
        {store.step === 4 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold">Configure & Generate Script</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ready to generate · ~4 min to your video
              </p>
            </div>

            <div className="mx-auto w-full max-w-lg">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  {/* Product summary — clickable to go back to step 1 */}
                  <button
                    type="button"
                    onClick={() => store.setStep(1)}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {selectedProduct && productImageMap[selectedProduct.id] ? (
                        <img
                          src={productImageMap[selectedProduct.id]!}
                          alt={selectedProduct.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Package className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Product</p>
                      <p className="truncate text-sm font-medium">
                        {selectedProduct?.name || "Not selected"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>

                  {/* Persona summary — clickable to go back to step 2 */}
                  <button
                    type="button"
                    onClick={() => store.setStep(2)}
                    className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {selectedPersona && personaImageMap[selectedPersona.id] ? (
                        <img
                          src={personaImageMap[selectedPersona.id]!}
                          alt={selectedPersona.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <User className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Persona</p>
                      <p className="truncate text-sm font-medium">
                        {selectedPersona?.name || "Not selected"}
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>

                  {/* Selected composite preview */}
                  {store.compositeImagePath && selectedCompositeIdx !== null && compositeImages[selectedCompositeIdx] && (
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "shrink-0 overflow-hidden rounded-lg bg-muted",
                          store.format === "9:16" ? "h-16 w-9" : "h-10 w-16",
                        )}
                      >
                        <img
                          src={compositeImages[selectedCompositeIdx].signed_url}
                          alt="Selected scene"
                          className="size-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Scene</p>
                        <p className="text-sm font-medium">
                          {store.format === "9:16" ? "Portrait 9:16" : "Landscape 16:9"}
                        </p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Mode selector */}
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      Generation mode
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (store.advancedMode && store.advancedSegments && "single" !== store.mode) {
                            if (!window.confirm("Switching modes will clear your advanced segment customizations. Continue?")) {
                              return;
                            }
                          }
                          store.setMode("single");
                          setScriptConfigChanged(true);
                        }}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                          store.mode === "single"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">
                            Single
                          </p>
                          <p className="text-sm font-bold text-primary">
                            {store.quality === "hd" ? CREDITS_PER_SINGLE_HD : CREDITS_PER_SINGLE} credits
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          1 complete video — fastest option
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (store.advancedMode && store.advancedSegments && "triple" !== store.mode) {
                            if (!window.confirm("Switching modes will clear your advanced segment customizations. Continue?")) {
                              return;
                            }
                          }
                          store.setMode("triple");
                          setScriptConfigChanged(true);
                        }}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                          store.mode === "triple"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">
                            3x
                          </p>
                          <p className="text-sm font-bold text-primary">
                            {store.quality === "hd" ? CREDITS_PER_BATCH_HD : CREDITS_PER_BATCH} credits
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          27 combinations (3 hooks x 3 bodies x 3 CTAs) — pick your best before rendering
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Quality selector */}
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      Video quality
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { store.setQuality("standard"); setScriptConfigChanged(true); }}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                          store.quality === "standard"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">
                          Kling 2.6
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Faster generation, great for testing
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => { store.setQuality("hd"); setScriptConfigChanged(true); }}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                          store.quality === "hd"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">
                            Kling V3
                          </p>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                          >
                            2x credits
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Best motion quality, ideal for final ads (2x credits)
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* CTA style selector */}
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">
                      CTA style
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {CTA_STYLE_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => { store.setCtaStyle(option.key); setScriptConfigChanged(true); }}
                          className={cn(
                            "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                            store.ctaStyle === option.key
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <p className="text-sm font-semibold text-foreground">
                            {option.label}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {option.description}
                          </p>
                          {option.example && (
                            <p className="mt-1 text-xs italic text-muted-foreground/70">
                              {option.example}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>

                    {requiresCommentKeyword && (
                      <div className="mt-3">
                        <Label htmlFor="cta-comment-keyword" className="text-xs text-muted-foreground">
                          Keyword viewers should comment
                        </Label>
                        <Input
                          id="cta-comment-keyword"
                          value={store.ctaCommentKeyword}
                          onChange={(e) =>
                            store.setCtaCommentKeyword(
                              e.target.value.replace(/[^a-zA-Z0-9 _-]/g, ""),
                            )}
                          placeholder='e.g. "link" or "deal"'
                          className="mt-1"
                          maxLength={30}
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Advanced Mode toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Advanced Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Customize script, emotion, and image per segment.
                      </p>
                    </div>
                    <Switch
                      checked={store.advancedMode}
                      onCheckedChange={handleAdvancedModeToggle}
                      disabled={isInitializingAdvanced || !store.productId || !store.personaId}
                    />
                  </div>

                  {store.advancedMode && !store.advancedSegments && !isInitializingAdvanced && (
                    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        Advanced mode enabled — customize each segment individually
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleInitializeAdvancedSegments}
                        disabled={!store.productId || !store.personaId}
                      >
                        Customize Segments
                        <ArrowRight className="ml-1 size-3.5" />
                      </Button>
                    </div>
                  )}

                  {isInitializingAdvanced && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Generating scripts…
                    </div>
                  )}

                  {/* Info */}
                  <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                    {store.mode === "single"
                      ? "You'll get 1 complete video combination."
                      : "You'll get 27 possible combinations (3x3x3)."}
                  </div>

                  {/* What happens next? collapsible */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowTimeline((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown className={cn("size-3.5 transition-transform", showTimeline && "rotate-180")} />
                      What happens next?
                    </button>
                    {showTimeline && (
                      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 font-semibold text-foreground">①</span>
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span>Generate Script</span>
                            <span className="font-mono text-muted-foreground/70">~15 seconds</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 font-semibold text-foreground">②</span>
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span>Queue video segments</span>
                            <span className="font-mono text-muted-foreground/70">
                              {store.mode === "single" ? "1 video" : "9–27 combos"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 font-semibold text-foreground">③</span>
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span>Kling AI renders</span>
                            <span className="font-mono text-muted-foreground/70">~3–4 min total (parallel)</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {requiresCommentKeyword && !commentKeyword && (
                    <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                      Add a comment keyword so we can write the CTA correctly.
                    </div>
                  )}

                  {/* Credit cost display */}
                  <div
                    className={cn(
                      "rounded-lg border px-4 py-3",
                      hasEnoughCredits
                        ? "border-border bg-muted/30"
                        : "border-amber-500/30 bg-amber-500/10",
                    )}
                  >
                    <p className={cn(
                      "text-sm",
                      hasEnoughCredits ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400",
                    )}>
                      {hasEnoughCredits ? (
                        <>
                          This will use{" "}
                          <span className="font-bold text-foreground">{effectiveCost} credits</span>
                          {!isUnlimitedCredits && (
                            <span> ({creditsRemaining} remaining)</span>
                          )}
                        </>
                      ) : (
                        <>
                          Not enough credits — you'll be prompted to top up
                          {!isUnlimitedCredits && (
                            <span className="block mt-0.5 text-xs">
                              Need <span className="font-bold">{effectiveCost}</span> credits ({creditsRemaining} remaining)
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Generate Script button states */}
                  {generateScript.isPending ? (
                    <Button disabled size="lg" className="w-full">
                      <Loader2 className="size-4 animate-spin" />
                      Generating script…
                    </Button>
                  ) : store.pendingScript ? (
                    <div className="flex flex-col gap-2">
                      <Button
                        size="lg"
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => store.setStep(5)}
                      >
                        <Check className="size-4" />
                        Review Script →
                      </Button>
                      {scriptConfigChanged && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setScriptConfigChanged(false);
                            handleGenerateScript();
                          }}
                          disabled={requiresCommentKeyword && !commentKeyword}
                        >
                          <RefreshCw className="size-3.5" />
                          Regenerate with new settings
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={handleGenerateScript}
                      disabled={requiresCommentKeyword && !commentKeyword}
                      size="lg"
                      className="w-full"
                    >
                      <Sparkles className="size-4" />
                      Generate Script
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Step 5: Review Script ──────────────────────────────────────── */}
        {store.step === 5 && store.pendingScript && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold">Review Script</h2>

            {/* Insufficient credits banner — visible immediately on Step 5 */}
            {!hasEnoughCredits && (
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                <AlertCircle className="size-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    Not enough credits
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You need <span className="font-bold">{effectiveCost}</span> credits but only have{" "}
                    <span className="font-bold">{creditsRemaining}</span>. Top up below or via the Generate button.
                  </p>
                </div>
              </div>
            )}

            <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">
              {/* Script sections — collapsible */}
              {(["hooks", "bodies", "ctas"] as const).map((sectionType, sectionIdx) => {
                const segments = store.pendingScript![sectionType];
                const sectionLabel = sectionType === "hooks" ? "Hooks" : sectionType === "bodies" ? "Bodies" : "CTAs";
                const singularLabel = sectionType === "hooks" ? "Hook" : sectionType === "bodies" ? "Body" : "CTA";
                const showAlts = sectionType === "hooks" ? showAltHooks : sectionType === "bodies" ? showAltBodies : showAltCtas;
                const setShowAlts = sectionType === "hooks" ? setShowAltHooks : sectionType === "bodies" ? setShowAltBodies : setShowAltCtas;

                return (
                  <div key={sectionType}>
                    {/* Section header */}
                    {sectionIdx > 0 && <Separator className="mb-4" />}
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{sectionLabel}</h3>
                      <Badge variant="outline" className="text-xs">
                        {segments.length} {segments.length === 1 ? "variant" : "variants"}
                      </Badge>
                    </div>

                    {/* Cards: first always visible, rest toggled */}
                    {segments.map((segment: ScriptSegment, idx: number) => {
                      if (idx > 0 && !showAlts) return null;
                      const cardLabel = idx === 0 ? "(Primary)" : `(Alt ${idx})`;

                      return (
                        <Card key={`${sectionType}-${idx}`} className="mb-3">
                          <CardContent className="flex flex-col gap-3 p-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-foreground">
                                {singularLabel}{" "}
                                <span className="font-normal text-muted-foreground">{cardLabel}</span>
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {formatVariantLabel(segment.variant_label)}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {segment.duration_seconds}s
                                </Badge>
                              </div>
                            </div>
                            <Textarea
                              value={segment.text}
                              onChange={(e) => store.updateScriptSection(sectionType, idx, e.target.value)}
                              rows={3}
                              className="resize-none text-sm"
                            />
                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={generateScript.isPending}
                                onClick={() => {
                                  if (!store.productId || !store.personaId || !store.compositeImagePath) {
                                    toast.error("Please go back to Step 3 to select a scene image first.");
                                    return;
                                  }
                                  generateScript.mutate(
                                    {
                                      product_id: store.productId,
                                      persona_id: store.personaId,
                                      mode: store.mode,
                                      quality: store.quality,
                                      composite_image_path: store.compositeImagePath,
                                      cta_style: store.ctaStyle,
                                      cta_comment_keyword: requiresCommentKeyword ? commentKeyword : undefined,
                                      phase: "script",
                                    },
                                    {
                                      onSuccess: (result) => {
                                        if (result.script) {
                                          const newSegments = result.script[sectionType];
                                          if (newSegments?.[idx]) {
                                            store.updateScriptSection(sectionType, idx, newSegments[idx].text);
                                          }
                                        }
                                        if (result.generation_id) {
                                          store.setPendingScript(
                                            result.generation_id,
                                            store.pendingScript!,
                                            store.creditsToCharge ?? 0,
                                          );
                                        }
                                      },
                                      onError: (err) => {
                                        toast.error(err.message || "Failed to regenerate");
                                      },
                                    },
                                  );
                                }}
                              >
                                {generateScript.isPending ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-3.5" />
                                )}
                                Regenerate {singularLabel}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    {/* Show alternatives toggle */}
                    {segments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowAlts(!showAlts)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronDown className={cn("size-3.5 transition-transform", showAlts && "rotate-180")} />
                        {showAlts ? "Hide alternatives" : `Show ${segments.length - 1} alternative${segments.length > 2 ? "s" : ""}`}
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    store.clearPendingScript();
                    store.setStep(4);
                  }}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button
                  onClick={handleApproveAndGenerate}
                  disabled={approveAndGenerate.isPending}
                  size="lg"
                >
                  {approveAndGenerate.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Starting generation...
                    </>
                  ) : (
                    <>
                      <Zap className="size-4" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ── Inline paywall (shown when user clicks Generate with insufficient credits) ── */}
            {showInlinePaywall && !hasEnoughCredits && (
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-background p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-primary" />
                  <h3 className="text-base font-semibold">Top up to continue</h3>
                </div>

                {/* First-video discount badge */}
                {isFirstVideo && (
                  <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 mb-4 flex items-center gap-2">
                    <Star className="size-3.5 text-amber-400 shrink-0" fill="currentColor" />
                    <p className="text-xs font-semibold text-amber-300">First video — 50% off credits (applied automatically)</p>
                  </div>
                )}

                {/* Countdown banner for first-purchase offer */}
                {offer.isActive && (
                  <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-orange-500 rounded-lg px-4 py-2.5 mb-4">
                    <div className="flex items-center gap-2">
                      <Flame className="size-4 text-white shrink-0" />
                      <p className="text-sm font-semibold text-white">30% off — new user offer</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/20 rounded-md px-2 py-0.5">
                      <Clock className="size-3 text-white/80" />
                      <span className="font-mono text-sm font-bold text-white tabular-nums">{offer.timeDisplay}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Subscriptions column */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Subscribe — best value
                    </p>
                    <div className="flex flex-col gap-2">
                      {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(([key, plan]) => {
                        const isGrowth = key === "growth";
                        const discountedMonthly = offer.isActive ? offer.discountedPrice(plan.price) : null;
                        return (
                          <div
                            key={key}
                            className={cn(
                              "relative flex items-center justify-between rounded-lg border px-3 py-2.5",
                              isGrowth
                                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                : "border-border hover:border-primary/30",
                            )}
                          >
                            {isGrowth && (
                              <div className="absolute -top-2 left-3">
                                <span className="bg-primary text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                                  Most popular
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold">{plan.name}</p>
                              <p className="text-[11px] text-muted-foreground">{plan.credits} cr/mo</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                {discountedMonthly !== null ? (
                                  <>
                                    <p className="text-sm font-bold text-primary">${discountedMonthly}</p>
                                    <p className="text-[10px] line-through text-muted-foreground/60">${plan.price}</p>
                                  </>
                                ) : (
                                  <p className="text-sm font-bold">${plan.price}<span className="text-[10px] font-normal text-muted-foreground">/mo</span></p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant={isGrowth ? "default" : "outline"}
                                onClick={() => handleCheckout(key)}
                                disabled={checkout.isPending}
                                className="shrink-0 text-xs h-8"
                              >
                                {checkout.isPending ? <Loader2 className="size-3 animate-spin" /> : "Choose"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Credit packs column */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      One-time packs
                    </p>
                    <div className="flex flex-col gap-2">
                      {(Object.entries(CREDIT_PACKS) as [CreditPackKey, (typeof CREDIT_PACKS)[CreditPackKey]][]).map(([key, pack]) => {
                        const discountedPackPrice = offer.isActive ? offer.discountedPrice(pack.price) : null;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:border-primary/30 transition-colors"
                          >
                            <div>
                              <p className="text-sm font-medium">{pack.credits} credits</p>
                              <p className="text-[11px] text-muted-foreground">{pack.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                {discountedPackPrice !== null ? (
                                  <>
                                    <p className="text-sm font-bold text-primary">${discountedPackPrice}</p>
                                    <p className="text-[10px] line-through text-muted-foreground/60">${pack.price}</p>
                                  </>
                                ) : (
                                  <p className="text-sm font-semibold">${pack.price}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleBuyPack(key)}
                                disabled={buyCredits.isPending}
                                className="border border-border text-xs h-8"
                              >
                                {buyCredits.isPending ? <Loader2 className="size-3 animate-spin" /> : "Buy"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <p className="text-center text-[11px] text-muted-foreground mt-3">
                  No commitment on packs · Cancel subscriptions anytime
                </p>
              </div>
            )}

            {/* Advanced Mode Panel — full width below the card */}
            {store.advancedMode && store.advancedSegments && !isInitializingAdvanced && (
              <div className="mt-4">
                <AdvancedModePanel
                  mode={store.mode}
                  segments={store.advancedSegments}
                  productId={store.productId!}
                  personaId={store.personaId!}
                  format={store.format ?? "9:16"}
                  mainCompositeSignedUrl={
                    selectedCompositeIdx !== null
                      ? compositeImages[selectedCompositeIdx]?.signed_url ?? null
                      : null
                  }
                  onSegmentUpdate={(type, index, patch) =>
                    store.updateAdvancedSegment(type, index, patch)
                  }
                />
              </div>
            )}
          </div>
        )}

      </div>

      {/* Navigation buttons */}
      {store.step < 5 && (
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="secondary"
          onClick={handleBack}
          disabled={store.step === 1}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {store.step < 4 && (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
      )}

      {/* Paywall dialog */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">

          {/* ── Countdown banner (first-paywall offer) ───────────────────── */}
          {offer.isActive && (
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-orange-500 px-5 py-3">
              <div className="flex items-center gap-2">
                <Flame className="size-4 text-white shrink-0" />
                <p className="text-sm font-semibold text-white">
                  New user offer — 30% off everything
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-black/20 rounded-md px-2.5 py-1 shrink-0">
                <Clock className="size-3 text-white/80" />
                <span className="font-mono text-sm font-bold text-white tabular-nums">
                  {offer.timeDisplay}
                </span>
              </div>
            </div>
          )}

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-background px-6 pt-5 pb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <TrendingUp className="size-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold leading-tight">
                  {creditsRemaining > 0
                    ? "Top up to keep going"
                    : "Add credits to generate your video"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  {creditsRemaining > 0
                    ? `You have ${creditsRemaining} credit${creditsRemaining !== 1 ? "s" : ""} — this generation needs ${effectiveCost}. Pick a plan or pack below.`
                    : "Traditional UGC creators charge $150–$500 per video. You're getting the same quality for a fraction of the cost."}
                </DialogDescription>
              </div>
            </div>

            {/* First-video credit discount (backend reduction — separate from price offer) */}
            {isFirstVideo && (
              <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 flex items-start gap-2.5">
                <Star className="size-4 text-amber-400 shrink-0 mt-0.5" fill="currentColor" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">First video — 50% off credits</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your first generation costs half the credits. Applies automatically.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Subscription plans */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subscribe — best value per credit
                </p>
                <span className="text-xs text-muted-foreground">vs $150–$500/video traditional</span>
              </div>
              <div className="flex flex-col gap-2">
                {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(([key, plan]) => {
                  const isGrowth = key === "growth";
                  const discountedMonthly = offer.isActive ? offer.discountedPrice(plan.price) : null;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "relative flex items-center justify-between rounded-xl border px-4 py-3 transition-colors",
                        isGrowth
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30",
                      )}
                    >
                      {isGrowth && (
                        <div className="absolute -top-2.5 left-4">
                          <span className="bg-primary text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                            Most popular
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{plan.name}</p>
                          <span className="text-xs text-muted-foreground">
                            {plan.credits} cr/mo
                          </span>
                        </div>
                        <p className="text-xs text-emerald-400 mt-0.5">
                          ≈ ${(plan.price / (plan.credits / 5)).toFixed(2)}/video vs $150–$500 traditional
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-right">
                          {discountedMonthly !== null ? (
                            <>
                              <div className="flex items-baseline gap-1 justify-end">
                                <p className="text-base font-bold text-primary">${discountedMonthly}</p>
                                <p className="text-[10px] text-muted-foreground">/mo</p>
                              </div>
                              <p className="text-[10px] line-through text-muted-foreground/60">
                                ${plan.price}/mo
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold">${plan.price}</p>
                              <p className="text-[10px] text-muted-foreground">/mo</p>
                            </>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={isGrowth ? "default" : "outline"}
                          onClick={() => handleCheckout(key)}
                          disabled={checkout.isPending}
                          className="shrink-0"
                        >
                          {checkout.isPending ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            isGrowth ? "Start now →" : "Choose"
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-border" />
              <span className="text-xs text-muted-foreground">or buy a one-time pack</span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* Credit packs */}
            <div className="flex flex-col gap-1.5">
              {(Object.entries(CREDIT_PACKS) as [CreditPackKey, (typeof CREDIT_PACKS)[CreditPackKey]][]).map(([key, pack]) => {
                const discountedPackPrice = offer.isActive ? offer.discountedPrice(pack.price) : null;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 hover:border-primary/30 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{pack.credits} credits</p>
                        {"badge" in pack && pack.badge && (
                          <Badge variant="secondary" className="text-[10px]">{pack.badge}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {pack.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {discountedPackPrice !== null ? (
                          <>
                            <p className="text-sm font-bold text-primary">${discountedPackPrice}</p>
                            <p className="text-[10px] line-through text-muted-foreground/60">${pack.price}</p>
                          </>
                        ) : (
                          <p className="text-sm font-semibold">${pack.price}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleBuyPack(key)}
                        disabled={buyCredits.isPending}
                        className="border border-border"
                      >
                        {buyCredits.isPending ? <Loader2 className="size-3 animate-spin" /> : "Buy"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[11px] text-muted-foreground -mt-1">
              No commitment on packs · Cancel subscriptions anytime
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
