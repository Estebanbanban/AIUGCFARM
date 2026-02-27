"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  Package,
  User,
  Zap,
  LinkIcon,
  Upload,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  PLANS,
  CREDITS_PER_SINGLE,
  CREDITS_PER_BATCH,
  CREDITS_PER_SINGLE_HD,
  CREDITS_PER_BATCH_HD,
  type PlanTier,
} from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Persona, Product, BrandSummary } from "@/types/database";
import { useCredits } from "@/hooks/use-credits";
import { useCreateGeneration } from "@/hooks/use-generations";
import { useCheckout } from "@/hooks/use-checkout";
import { ManualUploadForm } from "@/components/products/ManualUploadForm";
import { ScrapeResults } from "@/components/products/ScrapeResults";
import { PersonaBuilderInline } from "@/components/personas/PersonaBuilderInline";

const steps = [
  { number: 1, label: "Product" },
  { number: 2, label: "Persona" },
  { number: 3, label: "Generate" },
];

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

  // Step 1 — product add state
  const [addingProduct, setAddingProduct] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] =
    useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);

  // Step 2 — persona builder state
  const [buildingPersona, setBuildingPersona] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const productImageMap = useResolvedProductImages(products);
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const personaImageMap = useResolvedPersonaImages(personas);
  const scrapeProduct = useScrapeProduct();
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const createGeneration = useCreateGeneration();
  const checkout = useCheckout();

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const activePersonas = personas ?? [];

  const selectedProduct = confirmedProducts.find(
    (p) => p.id === store.productId,
  );
  const selectedPersona = activePersonas.find((p) => p.id === store.personaId);

  const creditsRemaining = credits?.remaining ?? 0;
  const creditCost =
    store.quality === "hd"
      ? store.mode === "single"
        ? CREDITS_PER_SINGLE_HD
        : CREDITS_PER_BATCH_HD
      : store.mode === "single"
        ? CREDITS_PER_SINGLE
        : CREDITS_PER_BATCH;
  const hasEnoughCredits = creditsRemaining >= creditCost;

  // Derived view states — no effects needed
  const showAddProductForm =
    addingProduct || (!productsLoading && confirmedProducts.length === 0);
  const showPersonaBuilder =
    buildingPersona || (!personasLoading && activePersonas.length === 0);

  function canProceed() {
    if (store.step === 1) return !!store.productId;
    if (store.step === 2) return !!store.personaId;
    return false;
  }

  function handleNext() {
    if (store.step < 3) store.setStep(store.step + 1);
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
      if (result.save_failed || !result.saved) {
        throw new Error(
          "We scraped this page but could not save products to your account. Please try again.",
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
          "No products were saved from this URL. Please try another page.",
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
    queryClient.invalidateQueries({ queryKey: ["products"] });
    if (firstId) {
      store.setProductId(firstId);
      store.setStep(2);
    }
    toast.success("Products imported!");
  }

  function handleManualUploadSuccess() {
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setAddingProduct(false);
    // Don't auto-advance — user needs to click their product in the grid
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
    queryClient.invalidateQueries({ queryKey: ["personas"] });
    store.setPersonaId(personaId);
    setBuildingPersona(false);
    store.setStep(3);
  }

  // ── Generation ───────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!hasEnoughCredits) {
      setShowPaywall(true);
      return;
    }
    if (!store.productId || !store.personaId) return;

    createGeneration.mutate(
      {
        product_id: store.productId,
        persona_id: store.personaId,
        mode: store.mode,
        quality: store.quality,
      },
      {
        onSuccess: (result) => {
          store.reset();
          router.push(`/generate/${result.generation_id}`);
          toast.success("Generation started!");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to start generation");
        },
      },
    );
  }

  async function handleCheckout(plan: PlanTier) {
    checkout.mutate(plan, {
      onSuccess: (url) => {
        window.location.href = url;
      },
      onError: (err) => {
        toast.error(err.message || "Failed to start checkout");
      },
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
                {creditsRemaining} credits remaining
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
                if (s.number < store.step) store.setStep(s.number);
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
                  <button
                    key={product.id}
                    onClick={() => store.setProductId(product.id)}
                    className="text-left"
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
                {activePersonas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => store.setPersonaId(persona.id)}
                    className="text-left"
                  >
                    <Card
                      className={cn(
                        "h-full transition-all",
                        store.personaId === persona.id
                          ? "border-primary ring-1 ring-primary/30"
                          : "hover:border-muted-foreground/30",
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
                        {store.personaId === persona.id && (
                          <div className="flex items-center gap-1.5 text-xs text-primary">
                            <Check className="size-3.5" />
                            Selected
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Step 3: Review & Generate ─────────────────────────────────── */}
        {store.step === 3 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold">Review & Generate</h2>

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
                            {CREDITS_PER_SINGLE} credits
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
                            {CREDITS_PER_BATCH} credits
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
                            2× credits
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          720p · kling-v3
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                    {store.mode === "single"
                      ? "You'll get 1 complete video combination."
                      : "You'll get 27 possible combinations (3x3x3)."}
                  </div>

                  {!hasEnoughCredits && !creditsLoading && (
                    <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                      You need {creditCost} credits but have{" "}
                      {creditsRemaining}. Subscribe or upgrade to continue.
                    </div>
                  )}

                  {/* Generate button */}
                  <Button
                    onClick={handleGenerate}
                    disabled={createGeneration.isPending}
                    size="lg"
                    className="w-full"
                  >
                    {createGeneration.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="size-4" />
                        Generate &mdash; {creditCost} credits
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="secondary"
          onClick={handleBack}
          disabled={store.step === 1}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {store.step < 3 && (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      {/* Paywall dialog */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {creditsRemaining > 0
                ? "Not Enough Credits"
                : "Subscription Required"}
            </DialogTitle>
            <DialogDescription>
              {creditsRemaining > 0
                ? `You need ${creditCost} credits but have ${creditsRemaining}. Upgrade your plan for more credits.`
                : "Choose a plan to start generating UGC videos."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {(
              Object.entries(PLANS) as [
                PlanTier,
                (typeof PLANS)[PlanTier],
              ][]
            ).map(([key, plan]) => (
              <div
                key={key}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-4 py-3",
                  key === "growth"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{plan.name}</p>
                    {key === "growth" && (
                      <Badge
                        variant="secondary"
                        className="bg-primary/10 text-xs text-primary"
                      >
                        Popular
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.credits} credits/month
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">${plan.price}/mo</span>
                  <Button
                    size="sm"
                    variant={key === "growth" ? "default" : "outline"}
                    onClick={() => handleCheckout(key)}
                    disabled={checkout.isPending}
                  >
                    {checkout.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
