"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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
import { useGenerationWizardStore } from "@/stores/generation-wizard";
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
import { PersonaBuilderInline } from "@/components/personas/PersonaBuilderInline";
import {
  trackProductImported,
  trackPersonaCreated,
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
    description: "Mixes CTA styles for variety.",
  },
  {
    key: "product_name_drop",
    label: "Name Drop",
    description: "Mentions the product name directly.",
  },
  {
    key: "link_in_bio",
    label: "Link in Bio",
    description: "Directs viewers to your bio link.",
  },
  {
    key: "link_in_comments",
    label: "Link in Comments",
    description: "Directs viewers to a comment link.",
  },
  {
    key: "comment_keyword",
    label: "Comment Keyword",
    description: "Asks for a keyword, ideal for ManyChat automation.",
  },
  {
    key: "check_description",
    label: "Check Description",
    description: "Sends viewers to the post description/caption.",
  },
] as const;

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
          const url = await resolvePersonaImageUrl(p.selected_image_url);
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

  // Reset wizard on mount so stale state from a previous session doesn't leak
  useEffect(() => {
    store.reset();
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

  // Step 2, persona builder state
  const [buildingPersona, setBuildingPersona] = useState(false);

  // Step 3, composite preview state
  const [compositeImages, setCompositeImages] = useState<
    Array<{ path: string; signed_url: string }>
  >([]);
  const [selectedCompositeIdx, setSelectedCompositeIdx] = useState<number | null>(null);
  const [showPreviewEditor, setShowPreviewEditor] = useState(false);
  const [previewEditPrompt, setPreviewEditPrompt] = useState("");

  // Step 4, advanced mode state
  const [isInitializingAdvanced, setIsInitializingAdvanced] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const productImageMap = useResolvedProductImages(products);
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const personaImageMap = useResolvedPersonaImages(personas);
  const scrapeProduct = useScrapeProduct();
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile } = useProfile();
  const generateComposites = useGenerateCompositeImages();
  const editComposite = useEditCompositeImage();
  const generateScript = useGenerateScript();
  const approveAndGenerate = useApproveAndGenerate();
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
  const effectiveCost = isFirstVideo ? Math.ceil(creditCost / 2) : creditCost;

  const hasEnoughCredits = isUnlimitedCredits || creditsRemaining >= effectiveCost;
  const requiresCommentKeyword = store.ctaStyle === "comment_keyword";
  const commentKeyword = store.ctaCommentKeyword
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, "");

  // Derived view states, no effects needed
  const showAddProductForm =
    addingProduct || (!productsLoading && confirmedProducts.length === 0);
  const showPersonaBuilder =
    buildingPersona || (!personasLoading && activePersonas.length === 0);

  function canProceed() {
    if (store.step === 1) return !!store.productId;
    if (store.step === 2) return !!store.personaId;
    if (store.step === 3) return !!store.compositeImagePath;
    // Step 4 proceeds via "Generate Script" button, not the generic Next button
    return false;
  }

  function handleNext() {
    if (store.step < 5) store.setStep(store.step + 1);
  }

  function handleBack() {
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
      store.setStep(2);
    }
    toast.success("Products imported!");
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

  // ── Persona builder callback ─────────────────────────────────────────────

  function handlePersonaSaved(personaId: string) {
    trackPersonaCreated();
    queryClient.invalidateQueries({ queryKey: ["personas"] });
    store.setPersonaId(personaId);
    setBuildingPersona(false);
    store.setStep(3);
  }

  // ── Composite preview handlers ───────────────────────────────────────────

  function handleFormatChange(format: "9:16" | "16:9") {
    store.setFormat(format);
    // Clear composites when format changes so user regenerates with correct aspect ratio
    setCompositeImages([]);
    setSelectedCompositeIdx(null);
    setShowPreviewEditor(false);
    store.setCompositeImagePath(null);
    setPreviewEditPrompt("");
  }

  async function handleGenerateComposites() {
    if (!store.productId || !store.personaId) return;
    setCompositeImages([]);
    setSelectedCompositeIdx(null);
    setShowPreviewEditor(false);
    store.setCompositeImagePath(null);
    setPreviewEditPrompt("");

    generateComposites.mutate(
      { product_id: store.productId, persona_id: store.personaId, format: store.format },
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
    store.setCompositeImagePath(compositeImages[idx].path);
  }

  function handleApplyPreviewEdit() {
    const trimmedPrompt = previewEditPrompt.trim();
    if (!store.compositeImagePath || !trimmedPrompt) return;

    editComposite.mutate(
      {
        composite_image_path: store.compositeImagePath,
        edit_prompt: trimmedPrompt,
        format: store.format,
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
    if (!hasEnoughCredits) {
      trackPaywallShown("insufficient_credits");
      offer.startOffer();
      setShowPaywall(true);
      return;
    }
    if (requiresCommentKeyword && !commentKeyword) {
      toast.error("Add a comment keyword for the CTA style.");
      return;
    }
    if (!store.productId || !store.personaId || !store.compositeImagePath) return;

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

  async function handleAdvancedModeToggle(enabled: boolean) {
    if (!enabled) {
      store.setAdvancedMode(false);
      return;
    }

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
    store.setAdvancedMode(true);
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
              /* Product grid */
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
            ) : null}
          </div>
        )}

        {/* ── Step 2: Persona ───────────────────────────────────────────── */}
        {store.step === 2 && (
          <div className="flex flex-col gap-4">
            {!showPersonaBuilder && (
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Select a Persona</h2>
                {activePersonas.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBuildingPersona(true)}
                  >
                    <Plus className="size-4" />
                    Create New
                  </Button>
                )}
              </div>
            )}

            {personasLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            ) : showPersonaBuilder ? (
              <PersonaBuilderInline
                onSaved={handlePersonaSaved}
                onCancel={
                  activePersonas.length > 0
                    ? () => setBuildingPersona(false)
                    : undefined
                }
              />
            ) : activePersonas.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activePersonas.map((persona) => {
                  const hasImage = !!persona.selected_image_url;
                  return (
                  <button
                    key={persona.id}
                    onClick={() => hasImage && store.setPersonaId(persona.id)}
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
            ) : null}
          </div>
        )}

        {/* ── Step 3: Preview ───────────────────────────────────────────── */}
        {store.step === 3 && (
          <div className="flex flex-col gap-6">
            {compositeImages.length === 0 ? (
              /* ── Before generation: large format picker + CTA ── */
              <div className="flex flex-col gap-6">
                <div>
                  <h2 className="text-lg font-semibold">Choose a Video Format</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pick the format for your ad. This sets the aspect ratio of your scene images and video.
                  </p>
                </div>

                {generateComposites.isPending ? (
                  <div className="flex flex-col items-center gap-4 py-20">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-base font-medium">Generating preview images…</p>
                    <p className="text-sm text-muted-foreground">This usually takes 20–40 seconds</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4 sm:max-w-lg">
                      <button
                        type="button"
                        onClick={() => handleFormatChange("9:16")}
                        className={cn(
                          "flex flex-col items-center gap-4 rounded-xl border-2 px-6 py-8 transition-all",
                          store.format === "9:16"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                        )}
                      >
                        <Smartphone className={cn("size-10", store.format === "9:16" ? "text-primary" : "text-muted-foreground")} />
                        <div className="text-center">
                          <p className="text-base font-semibold">Portrait</p>
                          <p className="mt-1 text-sm text-muted-foreground">9:16 · TikTok / Reels / Stories</p>
                        </div>
                        {store.format === "9:16" && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                            <Check className="size-3.5" /> Selected
                          </div>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleFormatChange("16:9")}
                        className={cn(
                          "flex flex-col items-center gap-4 rounded-xl border-2 px-6 py-8 transition-all",
                          store.format === "16:9"
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/30",
                        )}
                      >
                        <Monitor className={cn("size-10", store.format === "16:9" ? "text-primary" : "text-muted-foreground")} />
                        <div className="text-center">
                          <p className="text-base font-semibold">Landscape</p>
                          <p className="mt-1 text-sm text-muted-foreground">16:9 · YouTube / Facebook Ads</p>
                        </div>
                        {store.format === "16:9" && (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                            <Check className="size-3.5" /> Selected
                          </div>
                        )}
                      </button>
                    </div>

                    <Button size="lg" onClick={handleGenerateComposites} className="w-fit">
                      <ImageIcon className="size-4" />
                      Generate Preview Images
                    </Button>
                  </>
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
                    onClick={handleGenerateComposites}
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

                <p className="text-sm text-muted-foreground">
                  Click an image to select it — this becomes the base for your video.
                </p>

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
            <h2 className="text-lg font-semibold">Configure & Generate Script</h2>

            {generateScript.isPending ? (
              <div className="flex flex-col items-center gap-4 py-20">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-base font-medium">Generating your script...</p>
                <p className="text-sm text-muted-foreground">This usually takes 15-30 seconds</p>
              </div>
            ) : (
            <div className="mx-auto w-full max-w-lg">
              <Card>
                <CardContent className="flex flex-col gap-4 p-6">
                  {/* Product summary */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Product</p>
                      <p className="text-sm font-medium">
                        {selectedProduct?.name || "Not selected"}
                      </p>
                    </div>
                  </div>

                  {/* Persona summary */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <User className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Persona</p>
                      <p className="text-sm font-medium">
                        {selectedPersona?.name || "Not selected"}
                      </p>
                    </div>
                  </div>

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
                        onClick={() => store.setMode("single")}
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
                          1 hook · 1 body · 1 CTA
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => store.setMode("triple")}
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
                          3 hooks · 3 bodies · 3 CTAs
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
                        onClick={() => store.setQuality("standard")}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                          store.quality === "standard"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <p className="text-sm font-semibold text-foreground">
                          Standard
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          720p · kling-v2-6
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => store.setQuality("hd")}
                        className={cn(
                          "flex flex-col items-start rounded-lg border px-4 py-3 text-left transition-all",
                          store.quality === "hd"
                            ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                            : "border-border hover:border-muted-foreground/30",
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">
                            HD
                          </p>
                          <Badge
                            variant="secondary"
                            className="text-[10px]"
                          >
                            2x credits
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          720p · kling-v3
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
                          onClick={() => store.setCtaStyle(option.key)}
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

                  {requiresCommentKeyword && !commentKeyword && (
                    <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                      Add a comment keyword so we can write the CTA correctly.
                    </div>
                  )}

                  {!hasEnoughCredits && !creditsLoading && (
                    <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                      You need {creditCost} credits but have{" "}
                      {creditsRemaining}. Subscribe or upgrade to continue.
                    </div>
                  )}

                  {/* Generate Script button */}
                  <Button
                    onClick={handleGenerateScript}
                    disabled={generateScript.isPending || (requiresCommentKeyword && !commentKeyword)}
                    size="lg"
                    className="w-full"
                  >
                    <Sparkles className="size-4" />
                    Generate Script
                  </Button>
                </CardContent>
              </Card>
            </div>
            )}
          </div>
        )}

        {/* ── Step 5: Review Script ──────────────────────────────────────── */}
        {store.step === 5 && store.pendingScript && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold">Review Script</h2>

            <div className="mx-auto w-full max-w-2xl flex flex-col gap-4">
              {/* Script sections */}
              {(["hooks", "bodies", "ctas"] as const).map((sectionType) => (
                <div key={sectionType}>
                  {store.pendingScript![sectionType].map((segment: ScriptSegment, idx: number) => (
                    <Card key={`${sectionType}-${idx}`} className="mb-3">
                      <CardContent className="flex flex-col gap-3 p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold uppercase text-foreground">
                            {sectionType === "hooks" ? "Hook" : sectionType === "bodies" ? "Body" : "CTA"}
                            {store.pendingScript![sectionType].length > 1 ? ` ${idx + 1}` : ""}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {segment.variant_label}
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
                              if (!store.productId || !store.personaId || !store.compositeImagePath) return;
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
                                    // Update pendingGenerationId so the approval targets the
                                    // latest generation record (avoids approving a stale one).
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
                            Regenerate {sectionType === "hooks" ? "Hook" : sectionType === "bodies" ? "Body" : "CTA"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}

              {/* Credits info */}
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  This will use{" "}
                  <span className="font-semibold text-foreground">
                    {store.creditsToCharge ?? effectiveCost}
                  </span>{" "}
                  credits
                  {!isUnlimitedCredits && (
                    <>
                      {" "}({creditsRemaining} remaining)
                    </>
                  )}
                </p>
              </div>

              {!hasEnoughCredits && !creditsLoading && (
                <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                  You need {store.creditsToCharge ?? effectiveCost} credits but have{" "}
                  {creditsRemaining}. Subscribe or upgrade to continue.
                </div>
              )}

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
                  disabled={approveAndGenerate.isPending || (!hasEnoughCredits && !creditsLoading)}
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

            {/* Advanced Mode Panel — full width below the card */}
            {store.advancedMode && store.advancedSegments && !isInitializingAdvanced && (
              <div className="mt-4">
                <AdvancedModePanel
                  mode={store.mode}
                  segments={store.advancedSegments}
                  productId={store.productId!}
                  personaId={store.personaId!}
                  format={store.format}
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
                    ? "Almost there — just need a few more credits"
                    : "Your next video is one click away"}
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm">
                  {creditsRemaining > 0
                    ? `You have ${creditsRemaining} credit${creditsRemaining !== 1 ? "s" : ""}, but this generation needs ${effectiveCost}. Top up and keep going.`
                    : "Traditional UGC creators charge $150–$500 per video. You're getting the same quality for under $5."}
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
