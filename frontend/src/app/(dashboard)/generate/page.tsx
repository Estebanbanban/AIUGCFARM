"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Settings2,
  FlaskConical,
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { VideoGenerationAnimation } from "@/components/landing/VideoGenerationAnimation";
import { useProducts, useScrapeProduct } from "@/hooks/use-products";
import { isExternalUrl, getSignedImageUrl, getSignedImageUrls } from "@/lib/storage";
import { usePersonas, resolvePersonaImageUrl } from "@/hooks/use-personas";
import type { Persona, Product, BrandSummary, ScriptSegment } from "@/types/database";
import { useCredits } from "@/hooks/use-credits";
import {
  useEditCompositeImage,
  useGenerateCompositeImages,
  useGenerateScript,
  useApproveAndGenerate,
  useGenerations,
} from "@/hooks/use-generations";
import { useCheckout, useBuyCredits } from "@/hooks/use-checkout";
import { useProfile, HD_QUALITY_PLANS, ADVANCED_MODE_PLANS } from "@/hooks/use-profile";
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
import { NanoBananaLoader } from "@/components/ui/nano-loader";
import { callEdge, EdgeError } from "@/lib/api";
import type { GenerateSegmentScriptResponse, AdvancedSegmentsInput } from "@/types/api";
import type { AdvancedSegmentConfig, AdvancedSegmentsConfig } from "@/types/database";

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
  problem_solution: "Problem → Solution",
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
      const result: Record<string, string | null> = {};
      const pathsToSign: { productId: string; path: string }[] = [];

      // Pass 1: resolve external URLs immediately
      for (const p of products!) {
        const raw = p.images?.[0];
        if (!raw) {
          result[p.id] = null;
        } else if (isExternalUrl(raw)) {
          result[p.id] = raw;
        } else {
          result[p.id] = null;
          pathsToSign.push({ productId: p.id, path: raw });
        }
      }
      if (!cancelled) setImageMap({ ...result });

      // Pass 2: batch-sign all internal paths in a single request
      if (pathsToSign.length > 0) {
        const signedUrls = await getSignedImageUrls(
          "product-images",
          pathsToSign.map((p) => p.path),
        );
        if (!cancelled) {
          signedUrls.forEach((url, i) => {
            result[pathsToSign[i].productId] = url;
          });
          setImageMap({ ...result });
        }
      }
    }
    resolve();
    return () => { cancelled = true; };
  }, [products]);

  return imageMap;
}

function useResolvedPersonaImages(personas: Persona[] | undefined) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!personas || personas.length === 0) return;
    let cancelled = false;
    async function resolve() {
      const result: Record<string, string | null> = {};
      const pathsToSign: { personaId: string; path: string }[] = [];

      // Pass 1: resolve external URLs immediately (no API call needed)
      for (const p of personas!) {
        const raw = p.selected_image_url ?? p.generated_images?.[0] ?? null;
        if (!raw) {
          result[p.id] = null;
        } else if (raw.startsWith("http")) {
          result[p.id] = raw;
        } else {
          result[p.id] = null;
          pathsToSign.push({ personaId: p.id, path: raw });
        }
      }
      if (!cancelled) setImageMap({ ...result });

      // Pass 2: batch-sign all internal paths in a single request
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

const PLAN_BENEFITS: Record<PlanTier, string[]> = {
  starter: ["Standard rendering queue", "Watermark-free exports", "Commercial use license", "Standard support"],
  growth: ["Fast rendering priority", "Watermark-free exports", "Commercial use license", "Priority support"],
  scale: ["Highest rendering priority", "Watermark-free exports", "Commercial use license", "Dedicated manager", "Custom API limits"],
};

const VIDEO_GEN_STEPS = [
  { label: "Creating scene previews",    icon: <ImageIcon className="w-3 h-3" /> },
  { label: "Writing ad script",          icon: <FlaskConical className="w-3 h-3" /> },
  { label: "Launching video generation", icon: <Zap className="w-3 h-3" /> },
];

export default function GeneratePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const store = useGenerationWizardStore();
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallTab, setPaywallTab] = useState<"single" | "subscription">("single");

  // Validate persisted pendingGenerationId against DB on mount.
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
          // Reset to section 3 (step 4) if we were on old step 5
          if (store.step >= 5) store.setStep(4);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-close paywall when returning from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setShowPaywall(false);
    }
  }, []);

  // Product import state
  const [addingProduct, setAddingProduct] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);
  // Section 1 sub-steps: 1 = product selection, 2 = format selection
  const [section1SubStep, setSection1SubStep] = useState<1 | 2>(1);

  // Persona limit paywall
  const [showPersonaLimitPaywall, setShowPersonaLimitPaywall] = useState(false);

  // Composite preview state
  const [compositeImages, setCompositeImages] = useState<
    Array<{ path: string; signed_url: string }>
  >([]);
  const [selectedCompositeIdx, setSelectedCompositeIdx] = useState<number | null>(null);
  const [showPreviewEditor, setShowPreviewEditor] = useState(false);
  const [previewEditPrompt, setPreviewEditPrompt] = useState("");
  const [ctaOpen, setCtaOpen] = useState(false);

  const [showMoreCta, setShowMoreCta] = useState(false);

  // Advanced mode state
  const [isInitializingAdvanced, setIsInitializingAdvanced] = useState(false);

  // Tracks config changed after auto-fired script
  const [scriptConfigChanged, setScriptConfigChanged] = useState(false);

  // NanoBananaLoader state for video generation flow
  const [videoLoaderProgress, setVideoLoaderProgress] = useState(0);
  const [videoLoaderStep, setVideoLoaderStep] = useState(-1);
  const videoSimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tracks which format was used to fire background composite generation
  const generationFiredForFormat = useRef<string | null>(null);
  // Cancellation token for auto-fired script generation
  const scriptAutoFireToken = useRef(0);
  // Debounce timer for auto-regen on settings change
  const scriptRegenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: products, isLoading: productsLoading } = useProducts();
  const productImageMap = useResolvedProductImages(products);
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const personaImageMap = useResolvedPersonaImages(personas);
  const scrapeProduct = useScrapeProduct();
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const generateComposites = useGenerateCompositeImages();
  const editComposite = useEditCompositeImage();
  const generateScript = useGenerateScript();
  const approveAndGenerate = useApproveAndGenerate();
  const watchedGenerationsStore = useWatchedGenerationsStore();
  const checkout = useCheckout();
  const buyCredits = useBuyCredits();
  const offer = useFirstPurchaseOffer();
  const { data: generations } = useGenerations();

  // Auto-fire composites when arriving at Section 3 (step >= 4) via cold restore
  useEffect(() => {
    if (store.compositeImagePath) return;
    if (
      store.step >= 4 &&
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

  // Auto-select first composite when composites arrive
  useEffect(() => {
    if (compositeImages.length > 0 && selectedCompositeIdx === null) {
      handleSelectComposite(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositeImages.length]);

  // Cycling progress messages while composites generate
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

  // Cycling progress messages while script generates
  const SCRIPT_MESSAGES = [
    "Analysing your product details...",
    "Crafting the perfect hook...",
    "Writing a compelling body...",
    "Polishing the call-to-action...",
    "Almost there...",
  ];
  const [scriptMsgIdx, setScriptMsgIdx] = useState(0);
  useEffect(() => {
    if (!generateScript.isPending) { setScriptMsgIdx(0); return; }
    const id = setInterval(() => setScriptMsgIdx((i) => (i + 1) % SCRIPT_MESSAGES.length), 3200);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generateScript.isPending]);

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const activePersonas = personas ?? [];

  const selectedProduct = confirmedProducts.find((p) => p.id === store.productId);
  const selectedPersona = activePersonas.find((p) => p.id === store.personaId);

  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const userPlan = profile?.plan ?? "free";
  const canUseHD = HD_QUALITY_PLANS.has(userPlan) || profile?.role === "admin";
  const canUseAdvanced = ADVANCED_MODE_PLANS.has(userPlan) || profile?.role === "admin";
  const creditCost =
    store.quality === "hd"
      ? store.mode === "single"
        ? CREDITS_PER_SINGLE_HD
        : CREDITS_PER_BATCH_HD
      : store.mode === "single"
        ? CREDITS_PER_SINGLE
        : CREDITS_PER_BATCH;

  const isFirstVideo = profile?.first_video_discount_used === false;
  const effectiveCost = creditCost;

  const hasEnoughCredits = isUnlimitedCredits || creditsRemaining >= effectiveCost;
  const requiresCommentKeyword = store.ctaStyle === "comment_keyword";
  const commentKeyword = store.ctaCommentKeyword.trim().replace(/[^a-zA-Z0-9 _-]/g, "");

  const showAddProductForm =
    addingProduct || (!productsLoading && confirmedProducts.length === 0);

  // ── Section navigation ────────────────────────────────────────────────

  function handleOpenSection(section: 1 | 2) {
    // Clear state for sections after the one being re-opened
    setCompositeImages([]);
    setSelectedCompositeIdx(null);
    setShowPreviewEditor(false);
    setPreviewEditPrompt("");
    store.setCompositeImagePath(null);
    store.clearPendingScript();
    generationFiredForFormat.current = null;
    setScriptConfigChanged(false);
    if (section === 1) {
      // Also clear format so user explicitly re-chooses
      store.setStep(1);
      setSection1SubStep(1);
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

  // Cleanup interval on unmount
  useEffect(() => () => stopVideoSim(), []);

  // ── Composite preview handlers ───────────────────────────────────────────

  async function handleGenerateComposites(formatOverride?: "9:16" | "16:9", personaIdOverride?: string) {
    const format = formatOverride ?? store.format;
    const personaId = personaIdOverride ?? store.personaId;
    if (!store.productId || !personaId || !format) return;
    setCompositeImages([]);
    setSelectedCompositeIdx(null);
    setShowPreviewEditor(false);
    store.setCompositeImagePath(null);
    setPreviewEditPrompt("");

    setVideoLoaderStep(0);
    setVideoLoaderProgress(0);
    startVideoSim(0, 24, 45_000);

    generateComposites.mutate(
      { product_id: store.productId, persona_id: personaId, format },
      {
        onSuccess: (result) => {
          stopVideoSim();
          setVideoLoaderStep(-1);
          setVideoLoaderProgress(0);
          setCompositeImages(result.images);
          trackPreviewGenerated();
        },
        onError: (err) => {
          stopVideoSim();
          setVideoLoaderStep(-1);
          setVideoLoaderProgress(0);
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
    // Auto-fire script generation in background
    const token = ++scriptAutoFireToken.current;
    if (store.productId && store.personaId) {
      if (store.ctaStyle === "comment_keyword" && !store.ctaCommentKeyword.trim()) return;
      store.clearPendingScript();
      setScriptConfigChanged(false);
      setVideoLoaderStep(1);
      setVideoLoaderProgress(25);
      startVideoSim(25, 49, 75_000);

      generateScript.mutate(
        {
          product_id: store.productId,
          persona_id: store.personaId,
          mode: store.mode,
          quality: store.quality,
          composite_image_path: path,
          cta_style: store.ctaStyle,
          language: store.language,
          phase: "script",
        },
        {
          onSuccess: (result) => {
            stopVideoSim();
            setVideoLoaderStep(-1);
            setVideoLoaderProgress(0);
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
            stopVideoSim();
            setVideoLoaderStep(-1);
            setVideoLoaderProgress(0);
            toast.error("Script generation failed. Click 'Generate Script' to retry.");
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

  // ── Script generation ─────────────────────────────────────────────────

  async function handleGenerateScript() {
    if (requiresCommentKeyword && !commentKeyword) {
      toast.error("Add a comment keyword for the CTA style.");
      return;
    }
    if (!store.productId || !store.personaId) return;
    if (!store.compositeImagePath) {
      toast.error("Scene preview is still loading, please wait a moment.");
      return;
    }
    setScriptConfigChanged(false);
    setVideoLoaderStep(1);
    setVideoLoaderProgress(25);
    startVideoSim(25, 49, 75_000);

    generateScript.mutate(
      {
        product_id: store.productId,
        persona_id: store.personaId,
        mode: store.mode,
        quality: store.quality,
        composite_image_path: store.compositeImagePath,
        cta_style: store.ctaStyle,
        cta_comment_keyword: requiresCommentKeyword ? commentKeyword : undefined,
        language: store.language,
        phase: "script",
      },
      {
        onSuccess: (result) => {
          stopVideoSim();
          setVideoLoaderStep(-1);
          setVideoLoaderProgress(0);
          if (result.script) {
            trackScriptGenerated(store.mode, store.quality);
            store.setPendingScript(
              result.generation_id,
              result.script,
              result.credits_to_charge ?? effectiveCost,
            );
            // Script now shows inline - no step change needed
          } else {
            toast.error("Script was not returned. Please try again.");
          }
        },
        onError: (err) => {
          stopVideoSim();
          setVideoLoaderStep(-1);
          setVideoLoaderProgress(0);
          toast.error(err.message || "Failed to generate script");
        },
      },
    );
  }

  /** Debounced auto-regen: call when settings change and a script already exists */
  function debouncedRegenScript() {
    if (scriptRegenTimer.current) clearTimeout(scriptRegenTimer.current);
    scriptRegenTimer.current = setTimeout(() => {
      if (store.pendingScript) handleGenerateScript();
    }, 500);
  }

  // ── Approve & generate video ──────────────────────────────────────────

  function buildAdvancedSegmentsInput(segments: AdvancedSegmentsConfig): AdvancedSegmentsInput {
    const mapSeg = (seg: AdvancedSegmentConfig) => ({
      script_text: seg.scriptText,
      global_emotion: seg.globalEmotion,
      global_intensity: seg.globalIntensity,
      ...(seg.actionDescription && { action_description: seg.actionDescription }),
      ...(seg.imagePath && { image_path: seg.imagePath }),
    });
    return {
      hooks: segments.hooks.map(mapSeg),
      bodies: segments.bodies.map(mapSeg),
      ctas: segments.ctas.map(mapSeg),
    };
  }

  async function handleApproveAndGenerate() {
    if (!store.pendingGenerationId || !store.pendingScript) return;
    if (!hasEnoughCredits) {
      trackPaywallShown("insufficient_credits");
      offer.startOffer();
      // Set default tab based on generation context
      setPaywallTab(creditCost > CREDITS_PER_SINGLE_HD ? "subscription" : "single");
      setShowPaywall(true);
      return;
    }

    const advancedSegments =
      store.advancedMode && store.advancedSegments
        ? buildAdvancedSegmentsInput(store.advancedSegments)
        : undefined;

    setVideoLoaderStep(2);
    setVideoLoaderProgress(50);
    startVideoSim(50, 59, 10_000);

    approveAndGenerate.mutate(
      {
        generation_id: store.pendingGenerationId,
        override_script: store.pendingScript,
        advanced_segments: advancedSegments,
        video_provider: store.videoProvider,
      },
      {
        onSuccess: () => {
          const genId = store.pendingGenerationId!;
          trackVideoGenerationStarted(store.mode, store.quality);
          watchedGenerationsStore.add(genId, selectedProduct?.name);
          store.reset();
          router.push(`/generate/${genId}`);
          toast.success("Generation started!");
        },
        onError: (err: Error) => {
          stopVideoSim();
          setVideoLoaderStep(-1);
          setVideoLoaderProgress(0);
          // Backend 402 = insufficient credits → show paywall instead of toast
          if (err instanceof EdgeError && err.status === 402) {
            trackPaywallShown("insufficient_credits");
            offer.startOffer();
            setPaywallTab(creditCost > CREDITS_PER_SINGLE_HD ? "subscription" : "single");
            setShowPaywall(true);
          } else {
            toast.error(err.message || "Failed to start generation");
          }
        },
      },
    );
  }

  // ── Advanced mode ──────────────────────────────────────────────────────

  async function handleSwitchToAdvanced() {
    store.setAdvancedMode(true);
    // Auto-initialize if no segments yet
    if (!store.advancedSegments && !isInitializingAdvanced) {
      await handleInitializeAdvancedSegments();
    }
  }

  async function handleInitializeAdvancedSegments() {
    if (!store.productId || !store.personaId) return;

    setIsInitializingAdvanced(true);
    const variantCount = store.mode === "single" ? 1 : 3;
    const segTypes = ["hook", "body", "cta"] as const;

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

    store.setAdvancedSegments({ hooks, bodies, ctas });
    setIsInitializingAdvanced(false);
  }

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
      ? (isFirstVideo ? COUPON_50_OFF_FIRST_VIDEO : undefined)
      : COUPON_30_OFF;
    buyCredits.mutate({ pack, couponId, generation_id: store.pendingGenerationId ?? undefined }, {
      onSuccess: (url) => {
        if (pack in { pack_10: 1, pack_30: 1, pack_100: 1 }) {
          trackCreditsPurchased(pack as CreditPackKey);
        }
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
      ? "Create your first UGC ad — in seconds."
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
          action: {
            label: "Grab it",
            onClick: () => {
              offer.startOffer();
              setShowPaywall(true);
            },
          },
        });
      } else if (videosGenerated > 0) {
        toast("Come back when you're ready to scale your production.", {
          duration: 5000,
        });
      }
    }
    setShowPaywall(open);
  }

  // Section 1 is "complete" once the user has moved past it
  const section1Complete = store.step >= 2;
  // Section 2 is "complete" once the user is in Section 3
  const section2Complete = store.step >= 4;
  // Section 3 is unlocked
  const section3Unlocked = store.step >= 4;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
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

      {/* ── Section 1: Product & Format ───────────────────────────────── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        {/* Section header - always visible */}
        <div
          className={cn(
            "flex items-center justify-between px-5 py-4",
            section1Complete && "border-b-0",
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs font-bold",
              section1Complete
                ? "bg-primary/15 text-primary"
                : "bg-primary text-primary-foreground",
            )}>
              {section1Complete ? <Check className="size-3.5" /> : "1"}
            </div>
            <span className="text-sm font-semibold">
              {section1Complete && selectedProduct ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground">{selectedProduct.name}</span>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {store.format === "9:16" ? "Portrait 9:16" : "Landscape 16:9"}
                  </Badge>
                </span>
              ) : (
                section1SubStep === 2 ? "Select Format" : "Select Product"
              )}
            </span>
          </div>
          {section1Complete && (
            <button
              type="button"
              onClick={() => handleOpenSection(1)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Change
            </button>
          )}
        </div>

        {/* Section 1 sub-step 1: Product selection */}
        {!section1Complete && section1SubStep === 1 && (
          <div className="px-5 pb-5 flex flex-col gap-5">
            {/* Product selector */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Select a product</p>
                {!showAddProductForm && confirmedProducts.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setAddingProduct(true)}>
                    <Plus className="size-4" />
                    Add Product
                  </Button>
                )}
                {showAddProductForm && confirmedProducts.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleCancelAddProduct}>
                    ← Back to products
                  </Button>
                )}
              </div>

              {productsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-40 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : showAddProductForm ? (
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
                                if (e.key === "Enter") { e.preventDefault(); handleScrape(); }
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Supports Shopify stores and most e-commerce product pages.
                          </p>
                          {scrapeError && (
                            <p className="text-xs text-destructive">{scrapeError}</p>
                          )}
                        </div>
                        <Button onClick={handleScrape} disabled={!importUrl.trim() || scrapeProduct.isPending}>
                          {scrapeProduct.isPending ? (
                            <><Loader2 className="size-4 animate-spin" />Importing...</>
                          ) : "Import"}
                        </Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="upload">
                      <div className="pt-2">
                        <ManualUploadForm onSuccess={handleManualUploadSuccess} />
                      </div>
                    </TabsContent>
                  </Tabs>
                )
              ) : confirmedProducts.length > 0 ? (
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
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <ImageIcon className="size-8 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-medium">{product.name}</h3>
                              {product.price && (
                                <p className="mt-1 font-mono text-sm font-semibold">
                                  {product.currency === "USD" ? "$" : product.currency}
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

          </div>
        )}

        {/* Section 1 sub-step 2: Format selection */}
        {!section1Complete && section1SubStep === 2 && (
          <div className="border-t border-border px-5 pb-5 pt-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSection1SubStep(1)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                ← Back
              </button>
              <p className="text-sm font-medium text-muted-foreground">Choose format</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => store.setFormat("9:16")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm transition-all",
                  store.format === "9:16"
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30",
                )}
              >
                <Smartphone className="size-4" />
                <div className="text-left">
                  <p className="font-medium leading-none">Portrait</p>
                  <p className="text-xs opacity-60 mt-0.5">9:16 · TikTok, Reels</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => store.setFormat("16:9")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm transition-all",
                  store.format === "16:9"
                    ? "border-primary bg-primary/5 font-medium text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted/30",
                )}
              >
                <Monitor className="size-4" />
                <div className="text-left">
                  <p className="font-medium leading-none">Landscape</p>
                  <p className="text-xs opacity-60 mt-0.5">16:9 · YouTube, Meta</p>
                </div>
              </button>
            </div>
            <Button
              onClick={() => store.setStep(2)}
              disabled={!store.format}
              className="w-full sm:w-auto"
            >
              Continue
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* ── Sticky Continue - Section 1 product step ──────────────────── */}
      {!section1Complete && section1SubStep === 1 && confirmedProducts.length > 0 && !showAddProductForm && !productsLoading && (
        <div className="sticky bottom-4 z-20 flex justify-end pointer-events-none">
          <Button
            onClick={() => setSection1SubStep(2)}
            disabled={!store.productId}
            className="pointer-events-auto shadow-lg"
          >
            Continue
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {/* ── Section 2: Persona ────────────────────────────────────────── */}
      {store.step >= 2 && (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          {/* Section header */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                section2Complete
                  ? "bg-primary/15 text-primary"
                  : "bg-primary text-primary-foreground",
              )}>
                {section2Complete ? <Check className="size-3.5" /> : "2"}
              </div>
              <span className="text-sm font-semibold">
                {section2Complete && selectedPersona ? (
                  <span className="flex items-center gap-2">
                    {personaImageMap[selectedPersona.id] && (
                      <img
                        src={personaImageMap[selectedPersona.id]!}
                        alt={selectedPersona.name}
                        className="size-5 rounded-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="text-foreground">{selectedPersona.name}</span>
                  </span>
                ) : (
                  "AI Spokesperson"
                )}
              </span>
            </div>
            {section2Complete && (
              <button
                type="button"
                onClick={() => handleOpenSection(2)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Change
              </button>
            )}
          </div>

          {/* Section 2 body - only shown when not complete */}
          {!section2Complete && (
            <div className="px-5 pb-5 flex flex-col gap-4">
              {personasLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2].map((i) => (
                    <Card key={i} className="h-40 animate-pulse bg-muted" />
                  ))}
                </div>
              ) : activePersonas.length > 0 ? (
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
                              // Fire composites in background and advance to Section 3
                              handleGenerateComposites(undefined, persona.id);
                              generationFiredForFormat.current = store.format;
                              store.setStep(4);
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
                                      loading="lazy"
                                      decoding="async"
                                    />
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
                                    <AlertCircle className="size-3.5" />
                                    Needs image - visit Personas
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

                      {/* New Persona card */}
                      <button
                        className="text-left"
                        onClick={() => {
                          if (atLimit) {
                            offer.startOffer();
                            setShowPersonaLimitPaywall(true);
                          } else {
                            router.push("/personas/new?returnTo=/generate");
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
              ) : (
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col items-center gap-3 py-10">
                    <User className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No personas yet - create one first before generating a video.
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
        </div>
      )}

      {/* ── Section 3: Settings & Generate ───────────────────────────── */}
      {section3Unlocked && (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          {/* Section header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              3
            </div>
            <span className="text-sm font-semibold">Settings & Generate</span>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* ── NanoBananaLoader overlay ─────────────────────────── */}
            {videoLoaderStep >= 0 && (
              <NanoBananaLoader
                title="Creating Your Video"
                subtitle="This usually takes 1\u20133 minutes"
                steps={VIDEO_GEN_STEPS}
                currentStep={videoLoaderStep}
                progress={videoLoaderProgress}
                className="min-h-[350px]"
              />
            )}

            {/* ── Easy Mode ─────────────────────────────────────────── */}
            {!store.advancedMode && videoLoaderStep < 0 && (
              <div className="flex flex-col gap-5">
                {/* CTA style - collapsible */}
                <Collapsible open={ctaOpen} onOpenChange={setCtaOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border-2 border-border px-4 py-3 text-left transition-all hover:border-muted-foreground/30"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Customize CTA</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {CTA_STYLE_OPTIONS.find((o) => o.key === store.ctaStyle)?.label ?? "Auto"}
                        </Badge>
                        {ctaOpen ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      {CTA_STYLE_OPTIONS.filter((o) =>
                        o.key === "auto" || o.key === "link_in_bio" || o.key === "direct_website"
                      ).map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => { store.setCtaStyle(option.key); setScriptConfigChanged(true); debouncedRegenScript(); }}
                          className={cn(
                            "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                            store.ctaStyle === option.key
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <p className="text-sm font-semibold">{option.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                        </button>
                      ))}
                    </div>
                    {showMoreCta && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {CTA_STYLE_OPTIONS.filter((o) =>
                          o.key !== "auto" && o.key !== "link_in_bio" && o.key !== "direct_website"
                        ).map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => { store.setCtaStyle(option.key); setScriptConfigChanged(true); debouncedRegenScript(); }}
                            className={cn(
                              "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                              store.ctaStyle === option.key
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground/30",
                            )}
                          >
                            <p className="text-sm font-semibold">{option.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowMoreCta(v => !v)}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2"
                    >
                      {showMoreCta ? "Fewer CTA options \u25B2" : "More CTA options \u25BC"}
                    </button>
                    {requiresCommentKeyword && (
                      <div className="mt-3">
                        <Label htmlFor="cta-comment-keyword" className="text-xs text-muted-foreground">
                          Keyword viewers should comment
                        </Label>
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

                <div className="flex flex-col gap-5">
                    {/* Easy / Advanced mode tab */}
                    <div className="flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
                      <button
                        type="button"
                        onClick={() => store.setAdvancedMode(false)}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                          !store.advancedMode
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Zap className="size-4" />
                        Easy Mode
                      </button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (!store.advancedMode) {
                                  handleSwitchToAdvanced();
                                }
                              }}
                              className={cn(
                                "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                                store.advancedMode
                                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <Settings2 className="size-4" />
                              Advanced
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Customize each Hook, Body, and CTA script, voice, and timing individually before generating.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Mode selector */}
                    <div>
                      <p className="mb-2 text-sm font-medium">Generation mode</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            store.setMode("single");
                            setScriptConfigChanged(true);
                            debouncedRegenScript();
                          }}
                          className={cn(
                            "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                            store.mode === "single"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <p className="text-sm font-semibold">Single Ad</p>
                            <p className="text-sm font-bold text-primary">
                              {store.quality === "hd" ? CREDITS_PER_SINGLE_HD : CREDITS_PER_SINGLE} cr
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">1 complete video · fastest</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            store.setMode("triple");
                            setScriptConfigChanged(true);
                            debouncedRegenScript();
                          }}
                          className={cn(
                            "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                            store.mode === "triple"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <div className="flex w-full items-center justify-between">
                            <p className="text-sm font-semibold">Full Campaign</p>
                            <p className="text-sm font-bold text-primary">
                              {store.quality === "hd" ? CREDITS_PER_BATCH_HD : CREDITS_PER_BATCH} cr
                            </p>
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
                          onClick={() => { store.setQuality("standard"); store.setVideoProvider("kling"); setScriptConfigChanged(true); debouncedRegenScript(); }}
                          className={cn(
                            "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                            store.quality === "standard"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30",
                          )}
                        >
                          <p className="text-sm font-semibold">Standard</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">Kling 2.6 · Faster, great for testing</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            store.setQuality("hd");
                            setScriptConfigChanged(true);
                            debouncedRegenScript();
                          }}
                          className={cn(
                            "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                            store.quality === "hd"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-muted-foreground/30",
                          )}
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
                          <button
                            type="button"
                            onClick={() => store.setVideoProvider("kling")}
                            className={cn(
                              "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                              store.videoProvider === "kling"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground/30",
                            )}
                          >
                            <p className="text-sm font-semibold">Kling 3.0</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">Fast · proven quality</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => store.setVideoProvider("sora")}
                            className={cn(
                              "flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-all",
                              store.videoProvider === "sora"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground/30",
                            )}
                          >
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
                            onClick={() => { store.setLanguage(lang.code); setScriptConfigChanged(true); debouncedRegenScript(); }}
                            className={cn(
                              "rounded-lg border-2 px-3 py-1.5 text-sm transition-all",
                              store.language === lang.code
                                ? "border-primary bg-primary/5 font-medium text-primary"
                                : "border-border text-muted-foreground hover:border-muted-foreground/40",
                            )}
                          >
                            {lang.native}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Audio is rendered in English by the AI model. Script language affects the on-screen text only.
                      </p>
                    </div>
                  </div>

                {requiresCommentKeyword && !commentKeyword && (
                  <div className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                    Add a comment keyword above to generate the CTA correctly.
                  </div>
                )}

                {/* Composites generating indicator */}
                {generateComposites.isPending && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "relative overflow-hidden rounded-xl border border-border bg-muted",
                            store.format === "9:16" ? "aspect-[9/16]" : "aspect-video",
                          )}
                        >
                          <div
                            className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted to-muted-foreground/5"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col items-center gap-1.5 py-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        <span>{COMPOSITE_MESSAGES[compositeMsgIdx]}</span>
                      </div>
                      <p className="text-xs text-muted-foreground/60">
                        Usually takes about 45 seconds
                      </p>
                    </div>
                  </div>
                )}

                {/* Scene preview (compact) */}
                {!generateComposites.isPending && compositeImages.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Scene preview</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleGenerateComposites()}
                        disabled={generateComposites.isPending}
                        className="text-xs text-muted-foreground h-7"
                      >
                        <RefreshCw className="size-3 mr-1" />
                        Regenerate
                      </Button>
                    </div>
                    <div className={cn(
                      "grid gap-2",
                      store.format === "9:16" ? "grid-cols-4" : "grid-cols-2",
                    )}>
                      {compositeImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (i !== selectedCompositeIdx && store.pendingScript) setScriptConfigChanged(true);
                            setSelectedCompositeIdx(i);
                            setShowPreviewEditor(false);
                            const path = compositeImages[i].path;
                            store.setCompositeImagePath(path);
                          }}
                          className="group relative overflow-hidden rounded-lg focus:outline-none"
                        >
                          <div className={cn(
                            "relative overflow-hidden rounded-lg border-2 transition-all",
                            store.format === "9:16" ? "aspect-[9/16]" : "aspect-video",
                            selectedCompositeIdx === i
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-transparent group-hover:border-muted-foreground/40",
                          )}>
                            <img src={img.signed_url} alt={`Preview ${i + 1}`} className="size-full object-cover" loading="lazy" decoding="async" />
                            {selectedCompositeIdx === i && (
                              <div className="absolute inset-0 flex items-end justify-center bg-primary/10 pb-2">
                                <div className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                                  <Check className="size-2.5" />
                                  Selected
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Quick edit */}
                    {selectedCompositeIdx !== null && compositeImages[selectedCompositeIdx] && (
                      <div className="rounded-lg border border-border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Quick edit (optional)</p>
                            <p className="text-xs text-muted-foreground">Adjust outfit, background, or lighting.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleGenerateComposites()}
                              disabled={generateComposites.isPending}
                            >
                              {generateComposites.isPending ? (
                                <><Loader2 className="size-3.5 animate-spin" />Regenerating...</>
                              ) : (
                                <><RefreshCw className="size-3.5" />Regenerate image</>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowPreviewEditor((prev) => !prev)}
                            >
                              <Sparkles className="size-3.5" />
                              {showPreviewEditor ? "Hide" : "Edit"}
                            </Button>
                          </div>
                        </div>
                        {showPreviewEditor && (
                          <div className="mt-3 flex flex-col gap-3">
                            <Textarea
                              value={previewEditPrompt}
                              onChange={(e) => setPreviewEditPrompt(e.target.value)}
                              placeholder="Example: Change the outfit to a black hoodie and make the background a cozy cafe."
                              maxLength={500}
                              rows={2}
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreviewEditor(false)} disabled={editComposite.isPending}>
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleApplyPreviewEdit}
                                disabled={editComposite.isPending || !store.compositeImagePath || previewEditPrompt.trim().length === 0}
                              >
                                {editComposite.isPending ? (
                                  <><Loader2 className="size-3.5 animate-spin" />Applying...</>
                                ) : (
                                  <><Sparkles className="size-3.5" />Apply Edit</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* No composites + not pending - fallback generate button */}
                {!generateComposites.isPending && compositeImages.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={() => handleGenerateComposites()}
                    disabled={!store.productId || !store.personaId || !store.format}
                  >
                    <ImageIcon className="size-4" />
                    Generate Scene Preview
                  </Button>
                )}

                {/* Credit cost */}
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    This will use{" "}
                    <span className="font-bold text-foreground">{effectiveCost} credits</span>
                    {!isUnlimitedCredits && <span> ({creditsRemaining} remaining)</span>}
                  </p>
                </div>

                {/* ── Script / Generate area ────────────────────────── */}
                {generateComposites.isPending && !store.compositeImagePath ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-6 py-8 text-center">
                    <Loader2 className="size-7 animate-spin text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Preparing your scene…</p>
                      <p className="text-xs text-muted-foreground mt-1">We're generating a personalized preview with your persona & product. This takes a few seconds.</p>
                    </div>
                  </div>
                ) : generateScript.isPending ? (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-6 py-8 text-center">
                    <Loader2 className="size-7 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Writing your script…</p>
                      <p className="text-xs text-muted-foreground mt-1">{SCRIPT_MESSAGES[scriptMsgIdx]}</p>
                    </div>
                  </div>
                ) : store.pendingScript ? (
                  <div className="flex flex-col gap-4">
                    {/* Script auto-regenerates when settings change */}

                    {/* Script review - side-by-side for single mode, stacked for triple */}
                    <div className={cn(
                      "flex gap-4",
                      store.mode === "single" ? "flex-row items-start" : "flex-col",
                    )}>
                      {/* Selected composite preview (single mode only - left column) */}
                      {store.mode === "single" && selectedCompositeIdx !== null && compositeImages[selectedCompositeIdx] && (
                        <div className="shrink-0 w-[200px]">
                          <div className={cn(
                            "relative overflow-hidden rounded-lg border border-border",
                            store.format === "9:16" ? "aspect-[9/16]" : "aspect-video",
                          )}>
                            <img
                              src={compositeImages[selectedCompositeIdx].signed_url}
                              alt="Selected scene preview"
                              className="size-full object-cover"
                            />
                          </div>
                        </div>
                      )}

                      {/* Script content (right column in single mode) */}
                      <div className={cn("flex flex-col gap-1", store.mode === "single" ? "flex-1 min-w-0" : "")}>
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="size-4 text-emerald-500" />
                        <p className="text-sm font-semibold">Script ready - review & edit</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Edit any segment before generating your video.
                      </p>

                      {(["hooks", "bodies", "ctas"] as const).map((sectionType, sectionIdx) => {
                        const segments = store.pendingScript![sectionType];
                        const singularLabel = sectionType === "hooks" ? "Hook" : sectionType === "bodies" ? "Body" : "CTA";
                        const sectionLabel = sectionType === "hooks" ? "Hooks" : sectionType === "bodies" ? "Bodies" : "CTAs";

                        return (
                          <div key={sectionType} className="flex flex-col gap-2">
                            {sectionIdx > 0 && <Separator className="my-1" />}
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sectionLabel}</p>
                              <Badge variant="outline" className="text-[10px]">
                                {segments.length} {segments.length === 1 ? "variant" : "variants"}
                              </Badge>
                            </div>

                            {segments.map((segment: ScriptSegment, idx: number) => (
                              <Card key={`${sectionType}-${idx}`} className="border-border">
                                <CardContent className="flex flex-col gap-2 p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-xs font-semibold text-foreground">
                                        {singularLabel} {segments.length > 1 ? idx + 1 : ""}
                                      </p>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {formatVariantLabel(segment.variant_label)}
                                      </Badge>
                                      <Badge variant="outline" className="text-[10px]">
                                        {segment.duration_seconds}s
                                      </Badge>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] text-muted-foreground"
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
                                            language: store.language,
                                            phase: "script",
                                          },
                                          {
                                            onSuccess: (result) => {
                                              const newSegText = result.script?.[sectionType]?.[idx]?.text;
                                              if (newSegText !== undefined && result.generation_id) {
                                                const freshScript = useGenerationWizardStore.getState().pendingScript;
                                                const freshCredits = useGenerationWizardStore.getState().creditsToCharge ?? 0;
                                                if (freshScript) {
                                                  store.setPendingScript(
                                                    result.generation_id,
                                                    {
                                                      ...freshScript,
                                                      [sectionType]: freshScript[sectionType].map((seg, i) =>
                                                        i === idx ? { ...seg, text: newSegText } : seg
                                                      ),
                                                    },
                                                    freshCredits,
                                                  );
                                                }
                                              }
                                            },
                                            onError: (err) => { toast.error(err.message || "Failed to regenerate"); },
                                          },
                                        );
                                      }}
                                    >
                                      {generateScript.isPending ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <RefreshCw className="size-3" />
                                      )}
                                      Regen
                                    </Button>
                                  </div>
                                  <Textarea
                                    value={segment.text}
                                    onChange={(e) => store.updateScriptSection(sectionType, idx, e.target.value)}
                                    rows={3}
                                    className="resize-none text-sm"
                                  />
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                    </div>

                    {/* Generate Video */}
                    <Button
                      onClick={handleApproveAndGenerate}
                      disabled={approveAndGenerate.isPending || creditsLoading}
                      size="lg"
                      className="w-full"
                    >
                      {approveAndGenerate.isPending ? (
                        <><Loader2 className="size-4 animate-spin" />Starting generation...</>
                      ) : creditsLoading ? (
                        <><Loader2 className="size-4 animate-spin" />Checking credits...</>
                      ) : (
                        <><Zap className="size-4" />Generate Video</>
                      )}
                    </Button>
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
              </div>
            )}

            {/* ── Advanced Mode ─────────────────────────────────────── */}
            {store.advancedMode && videoLoaderStep < 0 && (
              <div className="flex flex-col gap-5">
                {isInitializingAdvanced ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/40 py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Generating scripts for all segments…</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {store.mode === "triple" ? "9 segments" : "3 segments"} · usually takes ~20 seconds
                      </p>
                    </div>
                  </div>
                ) : store.advancedSegments ? (
                  <>
                    <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      {store.mode === "triple"
                        ? "Customize each of the 9 segments - 3 variants × 3 types. Mix any combo for 27 unique videos."
                        : "Customize your Hook, Body, and CTA individually for full creative control."}
                    </div>
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
                      onSegmentUpdate={(type, index, patch) => store.updateAdvancedSegment(type, index, patch)}
                    />

                    <Separator />

                    {/* Credit cost */}
                    <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                      <p className="text-sm text-muted-foreground">
                        This will use{" "}
                        <span className="font-bold text-foreground">{effectiveCost} credits</span>
                        {!isUnlimitedCredits && <span> ({creditsRemaining} remaining)</span>}
                      </p>
                    </div>

                    {/* Generate buttons for advanced mode */}
                    {generateComposites.isPending && !store.compositeImagePath ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-6 py-8 text-center">
                        <Loader2 className="size-7 animate-spin text-muted-foreground" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Preparing your scene…</p>
                          <p className="text-xs text-muted-foreground mt-1">We're generating a personalized preview with your persona & product. This takes a few seconds.</p>
                        </div>
                      </div>
                    ) : generateScript.isPending ? (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-6 py-8 text-center">
                        <Loader2 className="size-7 animate-spin text-primary" />
                        <div>
                          <p className="text-sm font-semibold text-foreground">Writing your script…</p>
                          <p className="text-xs text-muted-foreground mt-1">{SCRIPT_MESSAGES[scriptMsgIdx]}</p>
                        </div>
                      </div>
                    ) : store.pendingScript ? (
                      <Button
                        onClick={handleApproveAndGenerate}
                        disabled={approveAndGenerate.isPending || creditsLoading}
                        size="lg"
                        className="w-full"
                      >
                        {approveAndGenerate.isPending ? (
                          <><Loader2 className="size-4 animate-spin" />Starting generation...</>
                        ) : creditsLoading ? (
                          <><Loader2 className="size-4 animate-spin" />Checking credits...</>
                        ) : (
                          <><Zap className="size-4" />Generate Video</>
                        )}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleGenerateScript}
                        size="lg"
                        className="w-full"
                      >
                        <Sparkles className="size-4" />
                        Generate Script
                      </Button>
                    )}
                  </>
                ) : (
                  /* No segments yet and not initializing - re-init option */
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-10">
                    <Settings2 className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Advanced segments failed to generate.</p>
                    <Button variant="outline" size="sm" onClick={handleInitializeAdvancedSegments}>
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Paywall dialog ────────────────────────────────────────────── */}
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
            <div className="text-center max-w-2xl mx-auto pt-10 pb-6 px-6">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
                {paywallHeadline}
              </h2>
              {paywallSublineStatic ? (
                <p className="text-muted-foreground font-medium">{paywallSublineStatic}</p>
              ) : (
                <p className="text-muted-foreground font-medium">
                  Traditional UGC costs{" "}
                  <span className="line-through decoration-muted-foreground/50">$150–$500</span>.
                  {" "}Get the same quality instantly for a fraction of the cost.
                </p>
              )}
            </div>

            <div className="flex justify-center mb-8 px-4">
              <div className="bg-muted/80 p-1.5 rounded-full inline-flex border border-border shadow-sm">
                <button
                  type="button"
                  onClick={() => setPaywallTab("single")}
                  className={cn(
                    "px-8 py-2.5 text-sm font-bold rounded-full transition-all duration-200",
                    paywallTab === "single"
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <>
                    {store.quality === "hd" ? "1 HD Video" : "1 Standard Video"}
                    {isFirstVideo && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        -50%
                      </span>
                    )}
                  </>
                </button>
                <button
                  type="button"
                  onClick={() => setPaywallTab("subscription")}
                  className={cn(
                    "flex items-center gap-2 px-8 py-2.5 text-sm font-bold rounded-full transition-all duration-200",
                    paywallTab === "subscription"
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Subscribe & Save
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold",
                    paywallTab === "subscription"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted-foreground/20 text-muted-foreground",
                  )}>
                    -30%
                  </span>
                </button>
              </div>
            </div>

            <div className="px-6 pb-10">
              {paywallTab === "single" ? (
                <div className="max-w-md mx-auto bg-card p-8 rounded-2xl border border-border shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-1">Single Video</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      Experience the quality before committing.
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="w-full p-5 rounded-2xl border-2 border-primary bg-primary/5 text-left">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 rounded-full border border-primary flex items-center justify-center shrink-0">
                            <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                          </div>
                          {store.quality === "hd" ? (
                            <div>
                              <span className="font-semibold text-foreground">Kling 3.0 · HD</span>
                              <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Best Quality</span>
                            </div>
                          ) : (
                            <span className="font-semibold text-foreground">Kling 2.6 · Standard</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isFirstVideo && (
                            <span className="text-sm text-muted-foreground line-through font-medium">
                              ${store.quality === "hd" ? `${CREDITS_PER_SINGLE_HD}.00` : `${CREDITS_PER_SINGLE}.00`}
                            </span>
                          )}
                          <span className="font-bold text-foreground text-lg">
                            ${store.quality === "hd"
                              ? (isFirstVideo ? (CREDITS_PER_SINGLE_HD / 2).toFixed(2) : `${CREDITS_PER_SINGLE_HD}.00`)
                              : (isFirstVideo ? (CREDITS_PER_SINGLE / 2).toFixed(2) : `${CREDITS_PER_SINGLE}.00`)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {store.quality === "standard" && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Want HD instead?{" "}
                        <button
                          type="button"
                          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                          onClick={() => setPaywallTab("subscription")}
                        >
                          Upgrade to a plan →
                        </button>
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full py-6 text-base font-bold"
                    onClick={() => handleBuyPack(store.quality === "hd" ? "single_hd" : "single_standard")}
                    disabled={buyCredits.isPending}
                  >
                    {buyCredits.isPending ? <Loader2 className="size-4 animate-spin" /> : "Generate Video →"}
                  </Button>
                  {videosGenerated === 0 && isFirstVideo && (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                        First video: 50% OFF applied automatically
                      </span>
                    </div>
                  )}
                  {videosGenerated > 0 && (
                    <p className="text-center text-xs text-primary/70 mt-2 font-medium">
                      You know it works. Keep scaling.
                    </p>
                  )}
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    Buying {store.quality === "hd" ? "10" : "5"} credits · Unused credits carry over for future videos
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
                    {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(([key, plan]) => {
                      const isGrowth = key === "growth";
                      const discountedMonthly = offer.discountedPrice(plan.price);
                      return (
                        <div
                          key={key}
                          className={cn(
                            "bg-card rounded-2xl p-7 relative flex flex-col",
                            isGrowth ? "border-2 border-primary shadow-lg" : "border border-border shadow-sm",
                          )}
                        >
                          {isGrowth && (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm whitespace-nowrap">
                              Most Popular
                            </div>
                          )}
                          <div className="mb-6">
                            <h3 className="text-xl font-bold text-foreground tracking-tight mb-1">{plan.name}</h3>
                            <p className="text-muted-foreground text-sm font-medium">{plan.credits} credits / mo</p>
                          </div>
                          <div className="mb-6">
                            <div className="flex items-end gap-2 mb-1">
                              <span className="text-4xl font-extrabold text-foreground tracking-tighter">
                                ${discountedMonthly}
                              </span>
                              <span className="text-muted-foreground font-medium mb-1">/mo</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="line-through text-muted-foreground">${plan.price}/mo</span>
                              <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md text-xs font-bold">-30%</span>
                            </div>
                            <div className="mt-3 inline-flex bg-muted border border-border text-muted-foreground text-xs font-bold px-3 py-1.5 rounded-lg">
                              ≈ ${(plan.price / (plan.credits / CREDITS_PER_SINGLE)).toFixed(2)}/video
                            </div>
                          </div>
                          <ul className="space-y-3 mb-8 flex-grow">
                            {PLAN_BENEFITS[key].map((benefit, i) => (
                              <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground font-medium leading-tight">
                                <Check className="size-4 text-primary shrink-0 mt-0.5" />
                                {benefit}
                              </li>
                            ))}
                          </ul>
                          <Button
                            variant={isGrowth ? "default" : "outline"}
                            className="w-full py-5 font-bold"
                            onClick={() => handleCheckout(key)}
                            disabled={checkout.isPending}
                          >
                            {checkout.isPending ? <Loader2 className="size-4 animate-spin" /> : `Choose ${plan.name}`}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-12 text-center max-w-2xl mx-auto">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-5">
                      Or buy one-time credit packs
                    </p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {(Object.entries(CREDIT_PACKS) as [CreditPackKey, (typeof CREDIT_PACKS)[CreditPackKey]][]).map(([key, pack]) => {
                        const discountedPackPrice = isFirstVideo ? offer.discountedVideoPrice(pack.price) : offer.discountedPrice(pack.price);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleBuyPack(key)}
                            disabled={buyCredits.isPending}
                            className="px-6 py-3 rounded-xl border border-border bg-card hover:border-muted-foreground/40 transition-colors text-sm disabled:opacity-50"
                          >
                            <span className="font-bold text-foreground">{pack.credits} credits</span>
                            {" "}
                            <span className="text-muted-foreground">
                              -{" "}
                              <span className="line-through">${pack.price}</span>{" "}
                              <span className="text-primary font-semibold">${discountedPackPrice}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Persona limit paywall dialog ─────────────────────────────── */}
      <Dialog open={showPersonaLimitPaywall} onOpenChange={setShowPersonaLimitPaywall}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
          <DialogTitle className="sr-only">Upgrade to create more personas</DialogTitle>

          {offer.isActive && (
            <div className="bg-primary text-primary-foreground px-4 py-2.5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm font-medium shrink-0">
              <div className="flex items-center gap-2">
                <Flame className="size-4" />
                <span>Limited-time offer - 30% off your first plan</span>
              </div>
              <div className="flex items-center gap-2 bg-black/15 px-2.5 py-0.5 rounded font-mono">
                <Clock className="size-3 opacity-80" />
                <span className="tabular-nums">{offer.timeDisplay}</span>
              </div>
            </div>
          )}

          <div className="overflow-y-auto flex-1 px-6 py-8 sm:px-10">
            <div className="text-center mb-8">
              <div className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                <User className="size-7 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {offer.isActive ? "Unlock More Personas - 30% Off" : "Unlock More Personas"}
              </h2>
              <p className="mt-2 text-muted-foreground max-w-md mx-auto">
                {(() => {
                  const plan = profile?.plan as PlanTier | undefined;
                  const personaLimit = plan && PLANS[plan] ? PLANS[plan].personas : 1;
                  return plan
                    ? `Your ${PLANS[plan as PlanTier]?.name ?? "current"} plan is limited to ${personaLimit} persona${personaLimit !== 1 ? "s" : ""}. Upgrade to create more.`
                    : "The free plan is limited to 1 persona. Upgrade to create more.";
                })()}
              </p>
            </div>

            {(() => {
              const currentPlan = profile?.plan as PlanTier | undefined;
              const currentLimit = currentPlan && PLANS[currentPlan] ? PLANS[currentPlan].personas : 1;
              return (
                <div className="grid gap-4 sm:grid-cols-3 max-w-3xl mx-auto">
                  {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(([key, plan]) => {
                    const isGrowth = key === "growth";
                    const discountedMonthly = offer.discountedPrice(plan.price);
                    const isCurrentPlan = currentPlan === key;
                    const isDowngrade = plan.personas <= currentLimit && !isCurrentPlan;
                    const isDisabled = checkout.isPending || isCurrentPlan || isDowngrade;
                    return (
                      <div
                        key={key}
                        className={cn(
                          "relative rounded-2xl border p-5 flex flex-col gap-4",
                          isGrowth ? "border-primary/40 bg-primary/5 shadow-md" : "border-border bg-card",
                          isDowngrade && "opacity-40",
                        )}
                      >
                        {isGrowth && (
                          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 text-xs">
                            Most popular
                          </Badge>
                        )}
                        <div>
                          <p className="font-semibold text-base">{plan.name}</p>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-bold">${discountedMonthly}</span>
                            <span className="text-sm text-muted-foreground line-through">${plan.price}</span>
                            <span className="text-xs text-muted-foreground">/mo</span>
                          </div>
                          <p className="mt-1 text-xs text-orange-500 font-medium">
                            Up to {plan.personas} persona{plan.personas !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={isGrowth ? "default" : "outline"}
                          className="w-full font-bold"
                          onClick={() => {
                            setShowPersonaLimitPaywall(false);
                            handleCheckout(key);
                          }}
                          disabled={isDisabled}
                        >
                          {isCurrentPlan
                            ? "Current plan"
                            : checkout.isPending
                            ? <Loader2 className="size-4 animate-spin" />
                            : `Choose ${plan.name}`}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <p className="mt-6 text-center text-xs text-muted-foreground">
              No commitment on packs · Cancel subscriptions anytime
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
