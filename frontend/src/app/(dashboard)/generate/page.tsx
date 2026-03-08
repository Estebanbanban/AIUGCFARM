"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ImageIcon,
  Loader2,
  Maximize2,
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
  Bookmark,
  Minus,
} from "lucide-react";
import { useFirstPurchaseOffer, COUPON_50_OFF_FIRST_VIDEO } from "@/hooks/use-first-purchase-offer";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useWatchedGenerationsStore } from "@/stores/watched-generations";
import { VideoGenerationAnimation } from "@/components/landing/VideoGenerationAnimation";
import { useProducts, useScrapeProduct } from "@/hooks/use-products";
import { isExternalUrl, getSignedImageUrl, getSignedImageUrls } from "@/lib/storage";
import { usePersonas, resolvePersonaImageUrl, useSelectPersonaImage } from "@/hooks/use-personas";
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
import { useProfile, ADVANCED_MODE_PLANS } from "@/hooks/use-profile";
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
import { BrandProfileCard } from "@/components/brand-profile-card";
import { callEdge, EdgeError } from "@/lib/api";
import type { GenerateSegmentScriptResponse, AdvancedSegmentsInput } from "@/types/api";
import type { AdvancedSegmentConfig, AdvancedSegmentsConfig } from "@/types/database";


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

/**
 * Resolve ALL image URLs for a single product (for the image selector).
 * Returns a map of raw path -> signed URL.
 */
function useResolvedAllProductImages(
  product: { images: string[] } | undefined,
) {
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!product?.images || product.images.length === 0) {
      setUrlMap({});
      return;
    }
    let cancelled = false;
    async function resolve() {
      const result: Record<string, string> = {};
      const toSign: string[] = [];

      for (const raw of product!.images) {
        if (!raw || typeof raw !== "string") continue;
        if (isExternalUrl(raw)) {
          result[raw] = raw;
        } else {
          toSign.push(raw);
        }
      }

      if (toSign.length > 0) {
        const signedUrls = await getSignedImageUrls("product-images", toSign);
        signedUrls.forEach((url, i) => {
          if (url) result[toSign[i]] = url;
        });
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
  starter: ["Rendering queue", "Watermark-free exports", "Commercial use license", "Standard support"],
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
      .maybeSingle()
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
  const [pickerPersona, setPickerPersona] = useState<Persona | null>(null);
  const [pickerOptions, setPickerOptions] = useState<Array<{ imageIndex: number; signedUrl: string }>>([]);
  const [pickerSelectedImageIndex, setPickerSelectedImageIndex] = useState<number | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);

  // Composite preview state
  const [compositeImages, setCompositeImages] = useState<
    Array<{ path: string; signed_url: string }>
  >([]);
  const [selectedCompositeIdx, setSelectedCompositeIdx] = useState<number | null>(null);
  const [isRestoringPreviews, setIsRestoringPreviews] = useState(false);
  const [previewRestoreReady, setPreviewRestoreReady] = useState(false);
  const [showPreviewEditor, setShowPreviewEditor] = useState(false);
  const [previewEditPrompt, setPreviewEditPrompt] = useState("");
  const [zoomedCompositeUrl, setZoomedCompositeUrl] = useState<string | null>(null);
  const [ctaOpen, setCtaOpen] = useState(false);

  const [showMoreCta, setShowMoreCta] = useState(false);

  // Advanced mode state
  const [isInitializingAdvanced, setIsInitializingAdvanced] = useState(false);

  // Tracks config changed after auto-fired script
  const [scriptConfigChanged, setScriptConfigChanged] = useState(false);

  // Save as Preset dialog state
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  // Brand summary editable state (synced from selected product)
  const [brandSummary, setBrandSummary] = useState<BrandSummary | null>(null);

  // NanoBananaLoader state for video generation flow
  const [videoLoaderProgress, setVideoLoaderProgress] = useState(0);
  const [videoLoaderStep, setVideoLoaderStep] = useState(-1);
  const videoSimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tracks which format was used to fire background composite generation
  const generationFiredForFormat = useRef<string | null>(null);
  const lastPreviewContextKeyRef = useRef<string | null>(null);
  // Cancellation token for auto-fired script generation
  const scriptAutoFireToken = useRef(0);
  // Tracks whether we've already restored advanced segment signed URLs this session
  const advancedImagesRestoredRef = useRef(false);
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
  const selectPersonaImage = useSelectPersonaImage();
  const generateScript = useGenerateScript();
  const approveAndGenerate = useApproveAndGenerate();
  const watchedGenerationsStore = useWatchedGenerationsStore();
  const checkout = useCheckout();
  const buyCredits = useBuyCredits();
  const offer = useFirstPurchaseOffer();

  // Ensure offer activates before the browser paints when any paywall opens.
  // useLayoutEffect fires synchronously after DOM mutation but before paint,
  // so discounted prices are visible on the very first frame.
  useLayoutEffect(() => {
    if (showPaywall || showPersonaLimitPaywall) {
      offer.startOffer();
    }
  }, [showPaywall, showPersonaLimitPaywall]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: generations } = useGenerations();
  const previewContextKey = useMemo(() => {
    if (!store.productId || !store.personaId || !store.format) return null;
    const refs =
      store.selectedProductImages.length > 0
        ? [...store.selectedProductImages].sort().join(",")
        : "auto";
    return `${store.productId}::${store.personaId}::${store.format}::${refs}`;
  }, [store.productId, store.personaId, store.format, store.selectedProductImages]);

  // Restore previously generated preview images for this exact context.
  // This prevents expensive re-generation when user revisits /generate.
  useEffect(() => {
    let cancelled = false;

    async function restoreCompositePreviews() {
      const previousContextKey = lastPreviewContextKeyRef.current;
      const contextChanged =
        previousContextKey !== null && previousContextKey !== previewContextKey;
      lastPreviewContextKeyRef.current = previewContextKey;
      if (contextChanged) {
        setCompositeImages([]);
        setSelectedCompositeIdx(null);
        store.setCompositeImagePath(null);
        store.clearPendingScript();
        generationFiredForFormat.current = null;
      }

      if (!previewContextKey) {
        if (!cancelled) setPreviewRestoreReady(true);
        return;
      }
      const cachedPaths = store.compositePreviewCache[previewContextKey] ?? [];
      const fallbackPath =
        !contextChanged && typeof store.compositeImagePath === "string"
          ? store.compositeImagePath
          : null;
      const pathsToRestore = cachedPaths.length > 0
        ? cachedPaths
        : fallbackPath
          ? [fallbackPath]
          : [];
      if (pathsToRestore.length === 0) {
        if (!cancelled) setPreviewRestoreReady(true);
        return;
      }

      if (!cancelled) setIsRestoringPreviews(true);
      try {
        const signed = await getSignedImageUrls("composite-images", pathsToRestore, 3600);
        if (cancelled) return;
        const restored = pathsToRestore
          .map((path, i) => ({ path, signed_url: signed[i] }))
          .filter((img) => typeof img.signed_url === "string" && img.signed_url.startsWith("https://")) as Array<{
            path: string;
            signed_url: string;
          }>;
        if (restored.length > 0) {
          setCompositeImages(restored);
          const selectedPath = typeof store.compositeImagePath === "string"
            ? store.compositeImagePath
            : null;
          const selectedIdx = selectedPath
            ? restored.findIndex((img) => img.path === selectedPath)
            : -1;
          if (selectedIdx < 0) {
            store.setCompositeImagePath(restored[0].path);
            setSelectedCompositeIdx(0);
          } else {
            setSelectedCompositeIdx(selectedIdx);
          }
          if (cachedPaths.length === 0) {
            store.setCompositePreviewCache(
              previewContextKey,
              restored.map((img) => img.path),
            );
          }
        }
      } catch {
        // Silent fallback: if restore fails, normal generation flow will run.
      } finally {
        if (!cancelled) {
          setIsRestoringPreviews(false);
          setPreviewRestoreReady(true);
        }
      }
    }

    setPreviewRestoreReady(false);
    void restoreCompositePreviews();
    return () => {
      cancelled = true;
    };
  }, [
    previewContextKey,
    store.compositePreviewCache,
    store.clearPendingScript,
    store.setCompositePreviewCache,
    store.setCompositeImagePath,
  ]);

  // Restore advanced segment custom image signed URLs after page navigation.
  // imagePath is persisted but imageSignedUrl expires — re-sign on mount.
  useEffect(() => {
    if (advancedImagesRestoredRef.current) return;
    if (!store.advancedMode || !store.advancedSegments) return;

    const toReSign: Array<{ type: "hooks" | "bodies" | "ctas"; index: number; path: string }> = [];
    (["hooks", "bodies", "ctas"] as const).forEach((type) => {
      store.advancedSegments![type].forEach((seg, index) => {
        if (seg.imagePath) {
          toReSign.push({ type, index, path: seg.imagePath });
        }
      });
    });

    advancedImagesRestoredRef.current = true;
    if (toReSign.length === 0) return;

    const paths = toReSign.map((s) => s.path);
    getSignedImageUrls("composite-images", paths, 3600)
      .then((signedUrls) => {
        toReSign.forEach(({ type, index }, i) => {
          const signedUrl = signedUrls[i];
          if (typeof signedUrl === "string" && signedUrl.startsWith("https://")) {
            store.updateAdvancedSegment(type, index, { imageSignedUrl: signedUrl });
          }
        });
      })
      .catch(() => {
        // Silent failure — images fall back to main composite
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.advancedMode, store.advancedSegments]);

  // Auto-fire composites when arriving at Section 3 (step >= 4) after restore check.
  useEffect(() => {
    if (!previewRestoreReady || isRestoringPreviews) return;
    if (store.compositeImagePath && compositeImages.length > 0) return;
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
  }, [store.step, previewRestoreReady, isRestoringPreviews]);

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
  const selectedProductAllImages = useResolvedAllProductImages(selectedProduct);
  const selectedPersona = activePersonas.find((p) => p.id === store.personaId);

  // Sync brandSummary state whenever the selected product changes
  useEffect(() => {
    setBrandSummary(selectedProduct?.brand_summary ?? null);
  }, [selectedProduct?.id]);

  async function handleBrandSummaryUpdate(updated: BrandSummary) {
    if (!store.productId) return;
    const supabase = createClient();
    await supabase
      .from("products")
      .update({ brand_summary: updated })
      .eq("id", store.productId);
    setBrandSummary(updated);
    toast.success("Brand profile updated");
  }

  const creditsRemaining = credits?.remaining ?? 0;
  const isUnlimitedCredits = credits?.is_unlimited === true;
  const userPlan = profile?.plan ?? "free";
  const canUseHD = true; // HD is available to all users with credits
  const canUseAdvanced = ADVANCED_MODE_PLANS.has(userPlan) || profile?.role === "admin";
  const totalSegments =
    store.mode === "triple"
      ? store.hooksCount + store.bodiesCount + store.ctasCount
      : 3; // single: 1 hook + 1 body + 1 cta = 3 segments

  const perSegmentRate =
    store.quality === "hd" ? 10 / 3 : 5 / 3;

  const creditCost = Math.ceil(totalSegments * perSegmentRate);

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
    setShowPreviewEditor(false);
    setPreviewEditPrompt("");
    store.clearPendingScript();
    generationFiredForFormat.current = null;
    setScriptConfigChanged(false);
    if (section === 1) {
      // Also clear format so user explicitly re-chooses
      store.setSelectedProductImages([]);
      store.setStep(1);
      setSection1SubStep(1);
    } else {
      store.setStep(2);
    }
  }

  async function handleOpenPersonaImagePicker(persona: Persona) {
    const generatedPaths = (persona.generated_images ?? []).filter(
      (img): img is string => typeof img === "string" && img.length > 0,
    );
    if (generatedPaths.length === 0) {
      toast.info("Portraits are still generating for this persona.");
      return;
    }

    setPickerPersona(persona);
    setPickerOptions([]);
    setPickerSelectedImageIndex(null);
    setPickerLoading(true);

    try {
      const limited = generatedPaths.slice(0, 4);
      const resolved = await Promise.all(
        limited.map(async (path, imageIndex) => {
          const signedUrl = await resolvePersonaImageUrl(path);
          return signedUrl ? { imageIndex, signedUrl } : null;
        }),
      );
      const options = resolved.filter(
        (item): item is { imageIndex: number; signedUrl: string } => item !== null,
      );
      setPickerOptions(options);
      if (options.length === 0) {
        toast.error("Couldn't load generated portraits. Please try again.");
      }
    } catch {
      toast.error("Couldn't load generated portraits. Please try again.");
    } finally {
      setPickerLoading(false);
    }
  }

  async function handleConfirmPersonaImageSelection() {
    if (!pickerPersona || pickerSelectedImageIndex === null) return;
    setPickerSaving(true);
    try {
      await selectPersonaImage.mutateAsync({
        persona_id: pickerPersona.id,
        image_index: pickerSelectedImageIndex,
      });
      await queryClient.invalidateQueries({ queryKey: ["personas"] });
      store.setPersonaId(pickerPersona.id);
      store.setStep(4);
      handleGenerateComposites(undefined, pickerPersona.id);
      generationFiredForFormat.current = store.format;
      setPickerPersona(null);
      setPickerOptions([]);
      setPickerSelectedImageIndex(null);
      toast.success("Persona selected. Generating scene previews...");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save persona image";
      toast.error(message);
    } finally {
      setPickerSaving(false);
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
    generationFiredForFormat.current = format;
    setShowPreviewEditor(false);
    setPreviewEditPrompt("");

    generateComposites.mutate(
      {
        product_id: store.productId,
        persona_id: personaId,
        format,
        ...(store.selectedProductImages.length > 0 && {
          selected_images: store.selectedProductImages,
        }),
      },
      {
        onSuccess: (result) => {
          setCompositeImages(result.images);
          const first = result.images[0]?.path ?? null;
          if (first) {
            store.setCompositeImagePath(first);
            setSelectedCompositeIdx(0);
          } else {
            store.setCompositeImagePath(null);
            setSelectedCompositeIdx(null);
          }
          if (previewContextKey) {
            store.setCompositePreviewCache(
              previewContextKey,
              result.images.map((img) => img.path),
            );
          }
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
    // If switching to a different image after a script was already generated, clear it
    // so the user knows they need to click "Generate Script" again.
    if (idx !== selectedCompositeIdx && store.pendingScript) {
      store.clearPendingScript();
      setScriptConfigChanged(false);
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
          if (previewContextKey) {
            store.appendCompositePreviewCache(previewContextKey, result.image.path);
          }
          setPreviewEditPrompt("");
          toast.success("Preview image updated");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to edit preview image");
        },
      },
    );
  }

  function handleRegenerateSelectedComposite() {
    if (selectedCompositeIdx === null || !compositeImages[selectedCompositeIdx] || !store.format) return;
    const selectedIdx = selectedCompositeIdx;
    const selectedPath = compositeImages[selectedIdx].path;
    const variationPrompt =
      "Create a different variation of this same ad scene while keeping the same persona identity and product. Change camera angle, background details, and pose subtly. Keep a natural photorealistic iPhone selfie style.";

    editComposite.mutate(
      {
        composite_image_path: selectedPath,
        edit_prompt: variationPrompt,
        format: store.format,
      },
      {
        onSuccess: (result) => {
          setCompositeImages((prev) => {
            if (!prev[selectedIdx]) return prev;
            const next = [...prev];
            next[selectedIdx] = result.image;
            if (previewContextKey) {
              store.setCompositePreviewCache(
                previewContextKey,
                next.map((img) => img.path),
              );
            }
            return next;
          });
          store.setCompositeImagePath(result.image.path);
          store.clearPendingScript();
          setScriptConfigChanged(false);
          setShowPreviewEditor(false);
          setPreviewEditPrompt("");
          toast.success("Selected preview regenerated");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to regenerate selected preview");
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
        hooks_count: store.mode === "triple" ? store.hooksCount : 1,
        bodies_count: store.mode === "triple" ? store.bodiesCount : 1,
        ctas_count: store.mode === "triple" ? store.ctasCount : 1,
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
          } else {
            toast.error("Script was not returned. Please try again.");
          }
        },
        onError: (err) => {
          if (err instanceof EdgeError && err.code === "RATE_LIMITED") {
            toast.error("You're generating too fast. Please wait a moment and try again.");
          } else {
            toast.error(err.message || "Failed to generate script");
          }
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
        video_quality: store.quality,
        seamless_mode: store.seamlessMode,
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
          // Structured error code or fallback to HTTP 402
          if (
            err instanceof EdgeError &&
            (err.code === "INSUFFICIENT_CREDITS" || err.status === 402)
          ) {
            trackPaywallShown("insufficient_credits");
            offer.startOffer();
            setPaywallTab(creditCost > CREDITS_PER_SINGLE_HD ? "subscription" : "single");
            setShowPaywall(true);
          } else if (
            err instanceof EdgeError &&
            (err.status === 409 || (err.code === "INVALID_INPUT" && err.message.includes("no longer awaiting approval")))
          ) {
            // Pending script became stale (already approved/failed/expired).
            // Clear it so user can regenerate script from current preview.
            store.clearPendingScript();
            toast.error("This script approval session expired. Please generate script again.");
          } else if (err instanceof EdgeError && err.code === "RATE_LIMITED") {
            toast.error("You're generating too fast. Please wait a moment and try again.");
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
    // Don't auto-initialize — user must click "Generate Scripts"
  }

  async function handleInitializeAdvancedSegments() {
    if (!store.productId || !store.personaId) return;
    if (!store.compositeImagePath) {
      toast.error("Scene preview is still loading, please wait a moment.");
      return;
    }

    setIsInitializingAdvanced(true);

    // If no pendingScript yet, generate it first — needed for approve-and-generate.
    if (!store.pendingScript) {
      try {
        const result = await generateScript.mutateAsync({
          product_id: store.productId,
          persona_id: store.personaId,
          mode: store.mode,
          quality: store.quality,
          composite_image_path: store.compositeImagePath,
          cta_style: store.ctaStyle,
          cta_comment_keyword: requiresCommentKeyword ? commentKeyword : undefined,
          language: store.language,
          hooks_count: store.mode === "triple" ? store.hooksCount : 1,
          bodies_count: store.mode === "triple" ? store.bodiesCount : 1,
          ctas_count: store.mode === "triple" ? store.ctasCount : 1,
          phase: "script",
        });
        if (result.script) {
          store.setPendingScript(result.generation_id, result.script, result.credits_to_charge ?? effectiveCost);
        } else {
          toast.error("Script generation failed. Please try again.");
          setIsInitializingAdvanced(false);
          return;
        }
      } catch {
        toast.error("Failed to generate base script. Please try again.");
        setIsInitializingAdvanced(false);
        return;
      }
    }
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
    const couponId = offer.getSubscriptionCoupon(plan);
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
    // Single videos: -50% during promo window. Credit packs: never discounted.
    const couponId = isSingleVideo && offer.isActive ? COUPON_50_OFF_FIRST_VIDEO : undefined;
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

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    setPresetSaving(true);
    setPresetError(null);
    try {
      await callEdge("create-preset", {
        body: {
          name: presetName.trim(),
          config: {
            product_id: store.productId,
            persona_id: store.personaId,
            mode: store.mode,
            quality: store.quality,
            format: store.format,
            cta_style: store.ctaStyle,
            cta_comment_keyword: store.ctaCommentKeyword || undefined,
            language: store.language,
            video_provider: store.videoProvider,
          },
        },
      });
      setPresetDialogOpen(false);
      setPresetName("");
      toast.success("Preset saved");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save preset";
      setPresetError(msg);
    } finally {
      setPresetSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const videosGenerated = (generations ?? []).filter((g) => g.status === "completed").length;

  const paywallHeadline =
    videosGenerated === 0
      ? "Create your first UGC ad in seconds."
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
  // Section 3 is available once product + format are configured
  const section3Unlocked = store.step >= 2;

  // Detect orphaned awaiting_approval generation (e.g. after localStorage wipe)
  const orphanedDraft = useMemo(() => {
    if (store.pendingGenerationId) return null; // already tracked in store
    return (generations ?? []).find((g) => g.status === "awaiting_approval") ?? null;
  }, [generations, store.pendingGenerationId]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Orphaned draft banner (localStorage cleared, pending script in DB) ── */}
      {orphanedDraft && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-4 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-400">
              You have a script awaiting approval. No credits charged yet.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={() => router.push("/dashboard")}
          >
            Review &amp; Approve
          </Button>
        </div>
      )}

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
            "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4",
            section1Complete && "border-b-0",
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
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
                <span className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 flex-wrap">
                  <span className="text-foreground truncate max-w-[200px] sm:max-w-none">{selectedProduct.name}</span>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs font-medium">
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
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {confirmedProducts.map((product) => (
                    <div key={product.id} className="group relative">
                      <button
                        onClick={() => store.setProductId(product.id)}
                        className="w-full"
                      >
                        <div
                          className={cn(
                            "overflow-hidden rounded-xl border transition-all",
                            store.productId === product.id
                              ? "border-primary ring-2 ring-primary/40"
                              : "border-border hover:border-muted-foreground/40",
                          )}
                        >
                          {/* Square image */}
                          <div className="relative aspect-square w-full overflow-hidden bg-muted">
                            {productImageMap[product.id] ? (
                              <img
                                src={productImageMap[product.id]!}
                                alt={product.name}
                                className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center">
                                <ImageIcon className="size-6 text-muted-foreground/50" />
                              </div>
                            )}
                            {/* Selected checkmark */}
                            {store.productId === product.id && (
                              <div className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary shadow">
                                <Check className="size-3 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          {/* Title */}
                          <div className="px-2 py-1.5">
                            <p className="truncate text-xs font-medium leading-snug">
                              {product.name}
                            </p>
                          </div>
                        </div>
                      </button>
                      {/* Edit — visible on hover */}
                      <Link
                        href={`/products/${product.id}`}
                        onClick={(e) => e.stopPropagation()}
                        title="Edit product"
                        className="absolute left-1.5 top-1.5 hidden size-6 items-center justify-center rounded-full bg-background/80 backdrop-blur shadow border border-border group-hover:flex"
                      >
                        <Pencil className="size-3 text-muted-foreground" />
                      </Link>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Product image selector (when selected product has >1 image) */}
            {selectedProduct && selectedProduct.images.length > 1 && store.productId && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Reference images
                  <span className="text-xs font-normal ml-1.5">
                    ({store.selectedProductImages.length > 0
                      ? store.selectedProductImages.length
                      : Math.min(selectedProduct.images.length, 4)} of {Math.min(selectedProduct.images.length, 4)} selected)
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Select which product images the AI should reference when creating your preview. All images are used by default.
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.images.slice(0, 4).map((imgPath, idx) => {
                    const resolvedUrl = selectedProductAllImages[imgPath];
                    const isSelected =
                      store.selectedProductImages.length === 0 ||
                      store.selectedProductImages.includes(imgPath);
                    return (
                      <button
                        key={imgPath}
                        type="button"
                        onClick={() => {
                          const current = store.selectedProductImages.length === 0
                            ? selectedProduct.images.slice(0, 4)
                            : [...store.selectedProductImages];
                          if (current.includes(imgPath)) {
                            if (current.length <= 1) return;
                            store.setSelectedProductImages(current.filter((p) => p !== imgPath));
                          } else {
                            store.setSelectedProductImages([...current, imgPath]);
                          }
                        }}
                        className={cn(
                          "relative size-16 rounded-lg overflow-hidden border-2 transition-all shrink-0",
                          isSelected
                            ? "border-primary ring-1 ring-primary/30"
                            : "border-border opacity-50 hover:opacity-75",
                        )}
                      >
                        {resolvedUrl ? (
                          <img
                            src={resolvedUrl}
                            alt={`Product image ${idx + 1}`}
                            className="size-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <div className="size-full bg-muted flex items-center justify-center">
                            <ImageIcon className="size-4 text-muted-foreground" />
                          </div>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold shrink-0",
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
                    <span className="text-foreground truncate max-w-[200px] sm:max-w-none">{selectedPersona.name}</span>
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
                        const hasSelectedImage = !!persona.selected_image_url;
                        const hasGeneratedChoices =
                          !hasSelectedImage && (persona.generated_images?.length ?? 0) > 0;
                        const canChoosePersona = hasSelectedImage || hasGeneratedChoices;
                        return (
                          <button
                            key={persona.id}
                            onClick={() => {
                              if (hasSelectedImage) {
                                store.setPersonaId(persona.id);
                                // Fire composites in background and advance to Section 3
                                handleGenerateComposites(undefined, persona.id);
                                generationFiredForFormat.current = store.format;
                                store.setStep(4);
                                return;
                              }
                              if (hasGeneratedChoices) {
                                handleOpenPersonaImagePicker(persona);
                              }
                            }}
                            disabled={!canChoosePersona}
                            className={cn(
                              "text-left",
                              !canChoosePersona && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <Card
                              className={cn(
                                "h-full transition-all",
                                store.personaId === persona.id
                                  ? "border-primary ring-1 ring-primary/30"
                                  : canChoosePersona
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
                                {!hasSelectedImage && hasGeneratedChoices ? (
                                  <div className="flex items-center gap-1.5 text-xs text-primary">
                                    <ImageIcon className="size-3.5" />
                                    Choose portrait
                                  </div>
                                ) : !canChoosePersona ? (
                                  <div className="flex items-center gap-1.5 text-xs text-amber-500">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    Generating portraits...
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
                      No personas yet. Create one first before generating a video.
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
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </div>
            <span className="text-sm font-semibold">Video Builder</span>
          </div>

          <div className="border-b border-border bg-muted/20 px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1">
                <span className="text-muted-foreground">Product</span>
                <span className="max-w-[180px] truncate font-medium text-foreground">
                  {selectedProduct?.name ?? "Not selected"}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSection(1)}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Edit
                </button>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1">
                <span className="text-muted-foreground">Persona</span>
                <span className="max-w-[150px] truncate font-medium text-foreground">
                  {selectedPersona?.name ?? "Not selected"}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSection(2)}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Edit
                </button>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-2.5 py-1">
                <span className="text-muted-foreground">Format</span>
                <span className="font-medium text-foreground">
                  {store.format === "9:16" ? "Portrait 9:16" : store.format === "16:9" ? "Landscape 16:9" : "Not selected"}
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenSection(1)}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-5">
            {videoLoaderStep >= 0 && (
              <NanoBananaLoader
                title="Creating Your Video"
                subtitle="This usually takes 1-3 minutes"
                steps={VIDEO_GEN_STEPS}
                currentStep={videoLoaderStep}
                progress={videoLoaderProgress}
                className="min-h-[350px]"
              />
            )}

            {!store.personaId && videoLoaderStep < 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                You can set video options now. Select a persona in step 2 once portraits are ready to auto-generate scene previews.
              </div>
            )}

            {videoLoaderStep < 0 && store.productId && (
              <BrandProfileCard
                key={store.productId}
                brandSummary={brandSummary}
                onSave={handleBrandSummaryUpdate}
                productId={store.productId}
              />
            )}

            {videoLoaderStep < 0 && (
              <>
                <div className={cn(
                  "lg:grid gap-5",
                  store.advancedMode ? "grid-cols-1" : "lg:grid-cols-[320px_minmax(0,1fr)]"
                )}>
                  {!store.advancedMode && (
                  <div className="space-y-4 self-start lg:sticky lg:top-24">
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">B. Scene</p>
                          <p className="mt-1 text-sm text-muted-foreground">Pick a preview image for this video.</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRegenerateSelectedComposite}
                          disabled={
                            generateComposites.isPending ||
                            editComposite.isPending ||
                            selectedCompositeIdx === null ||
                            !store.productId ||
                            !store.personaId ||
                            !store.format
                          }
                          className="h-7 px-2 text-xs"
                        >
                          <RefreshCw className="mr-1 size-3" />
                          Regenerate selected
                        </Button>
                      </div>

                      {generateComposites.isPending && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {[0, 1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className={cn(
                                  "relative overflow-hidden rounded-lg border border-border bg-muted",
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
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>{COMPOSITE_MESSAGES[compositeMsgIdx]}</span>
                          </div>
                        </div>
                      )}

                      {!generateComposites.isPending && compositeImages.length > 0 && (
                        <div className={cn("grid gap-2", store.format === "9:16" ? "grid-cols-2" : "grid-cols-1")}>
                          {compositeImages.map((img, i) => (
                            <div key={i} className="group relative">
                              <button
                                onClick={() => handleSelectComposite(i)}
                                className="relative w-full overflow-hidden rounded-lg focus:outline-none"
                              >
                                <div
                                  className={cn(
                                    "relative overflow-hidden rounded-lg border-2 transition-all",
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
                                    loading="lazy"
                                    decoding="async"
                                  />
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
                              {/* Zoom / fullscreen button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomedCompositeUrl(img.signed_url);
                                }}
                                className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                aria-label="View full size"
                              >
                                <Maximize2 className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {!generateComposites.isPending && compositeImages.length === 0 && (
                        <Button
                          variant="outline"
                          onClick={() => handleGenerateComposites()}
                          disabled={!store.productId || !store.personaId || !store.format}
                          className="w-full"
                        >
                          <ImageIcon className="size-4" />
                          Generate Scene Preview
                        </Button>
                      )}
                    </div>

                    {selectedCompositeIdx !== null && compositeImages[selectedCompositeIdx] && (
                      <div className="rounded-xl border border-border bg-background p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Quick Edit</p>
                            <p className="text-xs text-muted-foreground">Adjust outfit, background, or lighting.</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowPreviewEditor((prev) => !prev)}
                            className="h-7 px-2 text-xs"
                          >
                            {showPreviewEditor ? "Hide" : "Edit"}
                          </Button>
                        </div>

                        {showPreviewEditor && (
                          <div className="flex flex-col gap-3">
                            <Textarea
                              value={previewEditPrompt}
                              onChange={(e) => setPreviewEditPrompt(e.target.value)}
                              placeholder="Example: change the outfit to a black hoodie with a cozy cafe background."
                              maxLength={500}
                              rows={2}
                            />
                            <div className="flex items-center justify-end gap-2">
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
                                disabled={editComposite.isPending || !store.compositeImagePath || previewEditPrompt.trim().length === 0}
                              >
                                {editComposite.isPending ? (
                                  <><Loader2 className="size-3.5 animate-spin" />Applying...</>
                                ) : (
                                  <>Apply Edit</>
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  )}

                  <div className="min-w-0 space-y-5">
                    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                      <div className="mb-4 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">A. Video Setup</p>
                          <p className="mt-1 text-sm text-muted-foreground">Configure mode, quality, and script controls.</p>
                        </div>
                        {store.step >= 4 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 gap-1.5 text-muted-foreground"
                            onClick={() => setPresetDialogOpen(true)}
                          >
                            <Bookmark className="size-3.5" />
                            Save as preset
                          </Button>
                        )}
                      </div>

                      <div className="flex rounded-lg border border-border bg-muted/40 p-1">
                        <button
                          type="button"
                          onClick={() => store.setAdvancedMode(false)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                            !store.advancedMode
                              ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-semibold"
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
                                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-semibold"
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

                      {!store.advancedMode ? (
                        <div className="mt-5 space-y-5">
                          <div>
                            <p className="mb-2 text-sm font-medium">Generation mode</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => {
                                  store.setMode("single");
                                  setScriptConfigChanged(true);
                                  debouncedRegenScript();
                                }}
                                className={cn(
                                  "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
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
                                  "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
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
                            {store.mode === "triple" && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-4">
                                  {(
                                    [
                                      { label: "Hooks", value: store.hooksCount, set: store.setHooksCount },
                                      { label: "Bodies", value: store.bodiesCount, set: store.setBodiesCount },
                                      { label: "CTAs", value: store.ctasCount, set: store.setCtasCount },
                                    ] as const
                                  ).map(({ label, value, set }) => (
                                    <div key={label} className="flex flex-1 flex-col items-center gap-1">
                                      <span className="text-xs text-muted-foreground">{label}</span>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => set(value - 1)}
                                          disabled={value <= 1}
                                          aria-label={`Decrease ${label} count`}
                                        >
                                          <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-medium tabular-nums">{value}</span>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => set(value + 1)}
                                          disabled={value >= 5}
                                          aria-label={`Increase ${label} count`}
                                        >
                                          <Plus className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-center text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {store.hooksCount} × {store.bodiesCount} × {store.ctasCount} ={" "}
                                    {store.hooksCount * store.bodiesCount * store.ctasCount}
                                  </span>{" "}
                                  possible combinations
                                </p>
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="mb-2 text-sm font-medium">Video quality</p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => {
                                  store.setQuality("standard");
                                  store.setVideoProvider("kling");
                                  setScriptConfigChanged(true);
                                  debouncedRegenScript();
                                }}
                                className={cn(
                                  "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
                                  store.quality === "standard"
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-muted-foreground/30",
                                )}
                              >
                                <p className="text-sm font-semibold">Budget</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">kling-v2-6 · 720p · Fixed 5/10/5s</p>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  store.setQuality("hd");
                                  store.setVideoProvider("kling");
                                  setScriptConfigChanged(true);
                                  debouncedRegenScript();
                                }}
                                className={cn(
                                  "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
                                  store.quality === "hd"
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-muted-foreground/30",
                                )}
                              >
                                <p className="text-sm font-semibold">Premium</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">kling-v3 · 1080p · Flexible duration · Seamless mode</p>
                              </button>
                            </div>
                          </div>

                          {/* Seamless Mode toggle — HD only (kling-v3 image_tail) */}
                          {store.quality === "hd" && store.videoProvider === "kling" && (
                            <button
                              type="button"
                              onClick={() => store.setSeamlessMode(!store.seamlessMode)}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
                                store.seamlessMode
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-muted-foreground/30",
                              )}
                            >
                              <div>
                                <p className="text-sm font-semibold">Seamless transitions</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Each clip flows into the next for visual continuity
                                </p>
                              </div>
                              <div
                                className={cn(
                                  "ml-3 flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
                                  store.seamlessMode ? "bg-primary" : "bg-muted",
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-4 w-4 rounded-full bg-white shadow transition-transform",
                                    store.seamlessMode ? "translate-x-4" : "translate-x-0.5",
                                  )}
                                />
                              </div>
                            </button>
                          )}

                          <Collapsible open={ctaOpen} onOpenChange={setCtaOpen}>
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition-all hover:border-muted-foreground/30"
                              >
                                <p className="text-sm font-medium">Customize CTA</p>
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
                                    onClick={() => {
                                      store.setCtaStyle(option.key);
                                      setScriptConfigChanged(true);
                                      debouncedRegenScript();
                                    }}
                                    className={cn(
                                      "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
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
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {CTA_STYLE_OPTIONS.filter((o) =>
                                    o.key !== "auto" && o.key !== "link_in_bio" && o.key !== "direct_website"
                                  ).map((option) => (
                                    <button
                                      key={option.key}
                                      type="button"
                                      onClick={() => {
                                        store.setCtaStyle(option.key);
                                        setScriptConfigChanged(true);
                                        debouncedRegenScript();
                                      }}
                                      className={cn(
                                        "flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all",
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
                                onClick={() => setShowMoreCta((v) => !v)}
                                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {showMoreCta ? "Fewer CTA options ▲" : "More CTA options ▼"}
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

                          {requiresCommentKeyword && !commentKeyword && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
                              Add a comment keyword above to generate the CTA correctly.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-5 space-y-4">
                          {isInitializingAdvanced ? (
                            <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-muted/40 py-12">
                              <Loader2 className="size-6 animate-spin text-muted-foreground" />
                              <div className="text-center">
                                <p className="text-sm font-medium">Generating scripts for all segments...</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {store.mode === "triple" ? "9 segments" : "3 segments"} · usually takes ~20 seconds
                                </p>
                              </div>
                            </div>
                          ) : store.advancedSegments ? (
                            <>
                              <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                                {store.mode === "triple"
                                  ? "Customize each of the 9 segments: 3 variants × 3 types. Mix any combo for 27 unique videos."
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
                            </>
                          ) : (
                            <div className="rounded-xl border border-border bg-card p-6 space-y-3">
                              <div>
                                <h3 className="font-semibold text-base">Configure your advanced scripts</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Set your campaign options above (quality, number of variants), then generate scripts to customize each segment individually.
                                </p>
                              </div>
                              <Button
                                onClick={handleInitializeAdvancedSegments}
                                disabled={!store.productId || !store.personaId}
                              >
                                Generate Scripts
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {!store.advancedMode && (
                    <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">C. Script</p>
                          <p className="mt-1 text-sm text-muted-foreground">Review and edit before final generation.</p>
                        </div>
                        {store.pendingScript && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateScript}
                            disabled={generateScript.isPending || generateComposites.isPending || !store.compositeImagePath}
                            className="h-7 px-2 text-xs text-muted-foreground"
                          >
                            <RefreshCw className="mr-1 size-3" />
                            Regenerate script
                          </Button>
                        )}
                      </div>

                      {generateScript.isPending ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 px-6 py-8 text-center">
                          <Loader2 className="size-7 animate-spin text-primary" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">Writing your script...</p>
                            <p className="mt-1 text-xs text-muted-foreground">{SCRIPT_MESSAGES[scriptMsgIdx]}</p>
                          </div>
                        </div>
                      ) : store.pendingScript ? (
                        !store.advancedMode ? (
                          <div className="space-y-4">
                            {(["hooks", "bodies", "ctas"] as const).map((sectionType) => {
                              const segments = store.pendingScript![sectionType];
                              const singularLabel = sectionType === "hooks" ? "Hook" : sectionType === "bodies" ? "Body" : "CTA";
                              const sectionLabel = sectionType === "hooks" ? "Hooks" : sectionType === "bodies" ? "Bodies" : "CTAs";

                              return (
                                <div key={sectionType} className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{sectionLabel}</p>
                                    {segments.length > 1 && (
                                      <Badge variant="outline" className="text-[10px]">
                                        {segments.length} variants
                                      </Badge>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    {segments.map((segment: ScriptSegment, idx: number) => (
                                      <div key={`${sectionType}-${idx}`} className="rounded-lg border border-border bg-card p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
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
                                            size="icon"
                                            className="size-7 text-muted-foreground"
                                            aria-label={`Regenerate ${singularLabel.toLowerCase()} ${idx + 1}`}
                                            title={`Regenerate ${singularLabel.toLowerCase()} ${idx + 1}`}
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
                                                              i === idx ? { ...seg, text: newSegText } : seg,
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
                                            <RefreshCw className="size-3.5" />
                                          </Button>
                                        </div>
                                        <Textarea
                                          value={segment.text}
                                          onChange={(e) => store.updateScriptSection(sectionType, idx, e.target.value)}
                                          rows={3}
                                          className="resize-none text-sm bg-muted/30"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Switch to Advanced Mode */}
                            <div className="flex justify-end border-t border-border pt-3">
                              <button
                                type="button"
                                onClick={handleSwitchToAdvanced}
                                disabled={isInitializingAdvanced}
                                className="flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                {isInitializingAdvanced
                                  ? <Loader2 className="size-3 animate-spin" />
                                  : <Settings2 className="size-3" />
                                }
                                {isInitializingAdvanced ? "Switching to Advanced…" : "Edit in Advanced Mode →"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                            <p className="text-sm font-medium text-foreground">Script ready for advanced generation</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Your advanced segment settings are ready. Generate when you are satisfied with the setup.
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="rounded-xl border border-dashed border-border px-4 py-8 flex flex-col items-center gap-4 text-center">
                          <p className="text-sm text-muted-foreground">
                            Generate a script to review Hook, Body, and CTA text before launching the final video render.
                          </p>
                          <Button
                            onClick={handleGenerateScript}
                            disabled={(requiresCommentKeyword && !commentKeyword) || generateComposites.isPending || !store.compositeImagePath}
                          >
                            {generateComposites.isPending ? (
                              <><Loader2 className="size-4 animate-spin" />Waiting for scene preview...</>
                            ) : (
                              <>Generate Script</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                </div>

                <div className="sticky bottom-4 z-20 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        This run uses <span className="font-semibold text-foreground">{effectiveCost} credits</span>
                        {!isUnlimitedCredits && <span> ({creditsRemaining} remaining)</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Estimated generation time: {store.quality === "hd" ? "2-4 minutes" : "1-3 minutes"}
                      </p>
                    </div>
                    <div className="w-full sm:w-auto">
                      <Button
                        onClick={handleApproveAndGenerate}
                        disabled={!store.pendingScript || approveAndGenerate.isPending || creditsLoading}
                        size="lg"
                        className="w-full sm:min-w-[220px]"
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
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <Dialog
        open={pickerPersona !== null}
        onOpenChange={(open) => {
          if (!open && !pickerSaving) {
            setPickerPersona(null);
            setPickerOptions([]);
            setPickerSelectedImageIndex(null);
            setPickerLoading(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Choose your persona portrait</DialogTitle>
            <DialogDescription>
              Pick one portrait to continue. You can go back to persona editing if needed.
            </DialogDescription>
          </DialogHeader>

          {pickerLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : pickerOptions.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {pickerOptions.map((option) => (
                <button
                  key={option.imageIndex}
                  type="button"
                  onClick={() => setPickerSelectedImageIndex(option.imageIndex)}
                  className={cn(
                    "relative aspect-[3/4] overflow-hidden rounded-xl border-2 transition-all",
                    pickerSelectedImageIndex === option.imageIndex
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <img
                    src={option.signedUrl}
                    alt={`Persona portrait ${option.imageIndex + 1}`}
                    className="size-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  {pickerSelectedImageIndex === option.imageIndex && (
                    <div className="absolute right-2 top-2 rounded-full bg-primary p-1">
                      <Check className="size-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">
              Portraits are not ready yet. Try again in a few seconds.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              onClick={() => router.push("/personas/new?returnTo=/generate")}
              disabled={pickerSaving}
            >
              Go Back To Editing Persona
            </Button>
            <Button
              onClick={handleConfirmPersonaImageSelection}
              disabled={pickerSelectedImageIndex === null || pickerSaving}
            >
              {pickerSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Use this portrait"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
            <div className="text-center max-w-2xl mx-auto pt-6 sm:pt-10 pb-4 sm:pb-6 px-4 sm:px-6">
              <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
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

            <div className="flex justify-center mb-6 sm:mb-8 px-4">
              <div className="bg-muted/80 p-1 sm:p-1.5 rounded-full inline-flex border border-border shadow-sm">
                <button
                  type="button"
                  onClick={() => setPaywallTab("single")}
                  className={cn(
                    "px-4 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all duration-200",
                    paywallTab === "single"
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <>
                    {store.quality === "hd" ? "1 Premium Video" : "1 Budget Video"}
                    {isFirstVideo && (
                      <span className="ml-1 sm:ml-2 text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        -50%
                      </span>
                    )}
                  </>
                </button>
                <button
                  type="button"
                  onClick={() => setPaywallTab("subscription")}
                  className={cn(
                    "flex items-center gap-1 sm:gap-2 px-4 sm:px-8 py-2 sm:py-2.5 text-xs sm:text-sm font-bold rounded-full transition-all duration-200",
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
                    {offer.isActive ? "up to -50%" : "-30%"}
                  </span>
                </button>
              </div>
            </div>

            <div className="px-4 sm:px-6 pb-6 sm:pb-10">
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
                              <span className="font-semibold text-foreground">Kling 3.0 · Premium</span>
                              <span className="ml-2 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Best Quality</span>
                            </div>
                          ) : (
                            <span className="font-semibold text-foreground">Kling 2.6 · Budget</span>
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
                        Want Premium instead?{" "}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
                    {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(([key, plan]) => {
                      const isGrowth = key === "growth";
                      const isStarter = key === "starter";
                      const discountedMonthly = isStarter
                        ? offer.discountedStarterPrice(plan.price)
                        : offer.discountedPrice(plan.price);
                      const discountLabel = isStarter ? "-50%" : "-30%";
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
                            {offer.isActive && (
                              <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1 w-fit">
                                <Clock className="size-3 shrink-0" />
                                <span>Expires in {offer.timeDisplay}</span>
                              </div>
                            )}
                            <div className="flex items-end gap-2 mb-1">
                              <span className="text-4xl font-extrabold text-foreground tracking-tighter">
                                ${discountedMonthly}
                              </span>
                              <span className="text-muted-foreground font-medium mb-1">/mo</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <span className="line-through text-muted-foreground">${plan.price}/mo</span>
                              <span className="text-primary bg-primary/10 px-2 py-0.5 rounded-md text-xs font-bold">{discountLabel}</span>
                            </div>
                            <div className="mt-3 inline-flex bg-muted border border-border text-muted-foreground text-xs font-bold px-3 py-1.5 rounded-lg">
                              ≈ ${(discountedMonthly / (Math.floor(plan.credits / CREDITS_PER_BATCH) * 27)).toFixed(2)}/video
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
                            <span className="text-muted-foreground text-primary font-semibold">${pack.price}</span>
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

      {/* ── Composite image zoom dialog ───────────────────────────────── */}
      <Dialog open={zoomedCompositeUrl !== null} onOpenChange={(open) => { if (!open) setZoomedCompositeUrl(null); }}>
        <DialogContent className="flex flex-col items-center gap-4 sm:max-w-2xl p-4">
          <DialogHeader className="w-full">
            <DialogTitle className="text-sm font-medium">Scene Preview</DialogTitle>
          </DialogHeader>
          {zoomedCompositeUrl && (
            <img
              src={zoomedCompositeUrl}
              alt="Scene preview full size"
              className={cn(
                "w-full rounded-lg object-contain",
                store.format === "9:16" ? "max-h-[75vh]" : "max-h-[60vh]",
              )}
            />
          )}
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
                <span>Limited-time offer: 50% off Starter · 30% off Growth &amp; Scale</span>
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
                {offer.isActive ? "Unlock More Personas (up to 50% off)" : "Unlock More Personas"}
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
                    const isStarter = key === "starter";
                    const discountedMonthly = isStarter
                      ? offer.discountedStarterPrice(plan.price)
                      : offer.discountedPrice(plan.price);
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
                            Up to {plan.personas} persona{(plan.personas as number) !== 1 ? "s" : ""}
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

      {/* Save as Preset dialog */}
      <Dialog
        open={presetDialogOpen}
        onOpenChange={(open) => {
          setPresetDialogOpen(open);
          if (!open) {
            setPresetName("");
            setPresetError(null);
            setPresetSaving(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as Preset</DialogTitle>
            <DialogDescription>
              Save your current product, persona, and settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                placeholder="e.g. Brand A — Triple HD"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                maxLength={60}
              />
            </div>
            {presetError && (
              <p className="text-sm text-destructive">{presetError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={presetSaving || !presetName.trim()}>
              {presetSaving ? "Saving..." : "Save preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
