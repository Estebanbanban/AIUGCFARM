"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Upload,
  Loader2,
  Sparkles,
  User,
  Package,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  useVideoCreatorStore,
  type ScriptFormat,
  type ReferenceType,
  type SoraModel,
} from "@/stores/video-creator-store";
import {
  useGenerateSingleVideoScript,
  useSubmitSingleVideo,
  useSingleVideoStatus,
  useUploadReferenceImage,
} from "@/hooks/use-single-video";
import { usePersonas, resolvePersonaImageUrl } from "@/hooks/use-personas";
import { useProducts } from "@/hooks/use-products";
import { useCredits } from "@/hooks/use-credits";
import { isExternalUrl, getSignedImageUrl } from "@/lib/storage";
import type { Persona, Product } from "@/types/database";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

const REFERENCE_OPTIONS: { value: ReferenceType; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No reference image" },
  { value: "custom", label: "Custom Upload", description: "Upload your own image" },
  { value: "persona", label: "Persona Image", description: "Use a persona's face" },
  { value: "composite", label: "Composite", description: "Persona + Product blend" },
];

function creditCost(model: SoraModel): number {
  return model === "sora-2-pro" ? 10 : 5;
}

// ---------------------------------------------------------------------------
// Helper: Resolve persona image
// ---------------------------------------------------------------------------

function useResolvedPersonaImage(persona: Persona | undefined | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!persona) {
      setUrl(null);
      return;
    }
    const raw = persona.selected_image_url ?? persona.generated_images?.[0] ?? null;
    if (!raw) {
      setUrl(null);
      return;
    }
    if (raw.startsWith("http")) {
      setUrl(raw);
      return;
    }
    let cancelled = false;
    resolvePersonaImageUrl(raw).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [persona]);

  return url;
}

function useResolvedProductImage(product: Product | undefined | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!product) {
      setUrl(null);
      return;
    }
    const raw = product.images?.[0] ?? null;
    if (!raw) {
      setUrl(null);
      return;
    }
    if (isExternalUrl(raw)) {
      setUrl(raw);
      return;
    }
    let cancelled = false;
    getSignedImageUrl("product-images", raw).then((signed) => {
      if (!cancelled) setUrl(signed === "/placeholder-product.svg" ? null : signed);
    });
    return () => {
      cancelled = true;
    };
  }, [product]);

  return url;
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function VideoCreatorPage() {
  const router = useRouter();
  const store = useVideoCreatorStore();

  // Data hooks
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: credits } = useCredits();

  // Mutations
  const generateScript = useGenerateSingleVideoScript();
  const submitVideo = useSubmitSingleVideo();
  const uploadImage = useUploadReferenceImage();

  // Status polling (only when we have a generationId and video is submitted)
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { data: statusData } = useSingleVideoStatus(
    isSubmitted ? store.generationId : null,
  );

  // Local UI state
  const [dragOver, setDragOver] = useState(false);
  const [customPreviewUrl, setCustomPreviewUrl] = useState<string | null>(
    store.customReferencePreviewUrl,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived data
  const selectedPersona = personas?.find((p) => p.id === store.personaId) ?? null;
  const selectedProduct = products?.find((p) => p.id === store.productId) ?? null;
  const personaImageUrl = useResolvedPersonaImage(selectedPersona);
  const productImageUrl = useResolvedProductImage(selectedProduct);

  const cost = creditCost(store.soraModel);
  const hasEnoughCredits = (credits?.remaining ?? 0) >= cost || credits?.is_unlimited;

  // Script content check
  const hasScript =
    store.scriptFormat === "freeform"
      ? store.freeformPrompt.trim().length > 0
      : !!(
          store.structuredScript?.hook?.trim() ||
          store.structuredScript?.body?.trim() ||
          store.structuredScript?.cta?.trim()
        );

  const canAutoGenerate =
    store.scriptFormat === "structured" && (!!store.personaId || !!store.productId);

  // Determine the preview image based on reference type
  const previewImage = (() => {
    switch (store.referenceType) {
      case "custom":
        return customPreviewUrl;
      case "persona":
        return personaImageUrl;
      case "composite":
        return personaImageUrl; // Show persona image as a preview stand-in
      default:
        return null;
    }
  })();

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (customPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(customPreviewUrl);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on unmount

  // Navigate to result page when generation completes or starts processing
  useEffect(() => {
    if (isSubmitted && store.generationId) {
      // Navigate immediately after submit so the result page handles polling
      router.push(`/video-creator/${store.generationId}`);
    }
  }, [isSubmitted, store.generationId, router]);

  // ---- File upload handlers ----

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        toast.error("Please upload a JPEG, PNG, or WebP image.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image must be under 10MB.");
        return;
      }

      // Revoke previous blob URL to avoid memory leak
      if (customPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(customPreviewUrl);
      }

      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setCustomPreviewUrl(localUrl);
      store.setCustomReferencePreviewUrl(localUrl);

      try {
        const result = await uploadImage.mutateAsync(file);
        store.setCustomReferenceImagePath(result.path);
        toast.success("Reference image uploaded.");
      } catch {
        toast.error("Failed to upload image. Please try again.");
        setCustomPreviewUrl(null);
        store.setCustomReferencePreviewUrl(null);
        store.setCustomReferenceImagePath(null);
      }
    },
    [uploadImage, store],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
      // Reset so the same file can be re-selected
      e.target.value = "";
    },
    [handleFileUpload],
  );

  // ---- Script generation ----

  const handleAutoGenerate = useCallback(async () => {
    if (!canAutoGenerate) return;

    try {
      const result = await generateScript.mutateAsync({
        script_format: "structured",
        product_id: store.productId ?? undefined,
        persona_id: store.personaId ?? undefined,
        is_saas: store.isSaas,
        language: store.language,
      });

      if (result.script) {
        store.setStructuredScript({
          hook: result.script.hook,
          body: result.script.body,
          cta: result.script.cta,
        });
      }
      store.setGenerationId(result.generation_id);
      store.setCreditsToCharge(result.credits_to_charge);
      toast.success("Script generated! Review and edit as needed.");
    } catch {
      toast.error("Failed to generate script. Please try again.");
    }
  }, [canAutoGenerate, generateScript, store]);

  const handleAutoGenerateFreeform = useCallback(async () => {
    if (!canAutoGenerate) return;

    try {
      const result = await generateScript.mutateAsync({
        script_format: "freeform",
        product_id: store.productId ?? undefined,
        persona_id: store.personaId ?? undefined,
        is_saas: store.isSaas,
        language: store.language,
      });

      if (result.freeform_prompt) {
        store.setFreeformPrompt(result.freeform_prompt);
      }
      store.setGenerationId(result.generation_id);
      store.setCreditsToCharge(result.credits_to_charge);
      toast.success("Prompt generated! Review and edit as needed.");
    } catch {
      toast.error("Failed to generate prompt. Please try again.");
    }
  }, [canAutoGenerate, generateScript, store]);

  // ---- Video generation ----

  const handleGenerate = useCallback(async () => {
    if (!hasScript) {
      toast.error("Please add a script before generating.");
      return;
    }

    if (!hasEnoughCredits) {
      toast.error("Insufficient credits. Please purchase more credits to continue.");
      return;
    }

    try {
      // Step 1: Always call script phase to capture any edits
      let genId = store.generationId;

      // If script was edited after auto-generate, force re-creation
      if (genId && store.scriptFormat === "structured" && store.structuredScript) {
        genId = null;
        store.setGenerationId(null);
      }

      if (!genId) {
        const scriptResult = await generateScript.mutateAsync({
          script_format: store.scriptFormat,
          product_id: store.productId ?? undefined,
          persona_id: store.personaId ?? undefined,
          is_saas: store.isSaas,
          language: store.language,
          freeform_prompt:
            store.scriptFormat === "freeform" ? store.freeformPrompt : undefined,
          structured_script:
            store.scriptFormat === "structured" && store.structuredScript
              ? store.structuredScript
              : undefined,
        });

        genId = scriptResult.generation_id;
        store.setGenerationId(genId);
        store.setCreditsToCharge(scriptResult.credits_to_charge);
      }

      // Step 2: Submit for video generation (full phase)
      await submitVideo.mutateAsync({
        generation_id: genId,
        sora_model: store.soraModel,
        duration: store.duration,
        reference_type: store.referenceType,
        reference_image_path:
          store.referenceType === "custom"
            ? store.customReferenceImagePath ?? undefined
            : undefined,
      });

      setIsSubmitted(true);
      toast.success("Video generation started!");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start generation.";
      toast.error(message);
    }
  }, [
    hasScript,
    hasEnoughCredits,
    store,
    generateScript,
    submitVideo,
  ]);

  const isGenerating =
    generateScript.isPending || submitVideo.isPending || isSubmitted;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Video Creator</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate a single continuous video with Sora 2
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ============================================================= */}
        {/* LEFT PANEL — Configuration                                     */}
        {/* ============================================================= */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Section 1: Script */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Script</CardTitle>
              <CardDescription>
                Write your video script or let AI generate one
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Tabs
                value={store.scriptFormat}
                onValueChange={(v) => store.setScriptFormat(v as ScriptFormat)}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="freeform" className="flex-1">
                    Freeform
                  </TabsTrigger>
                  <TabsTrigger value="structured" className="flex-1">
                    Structured
                  </TabsTrigger>
                </TabsList>

                {/* Freeform tab */}
                <TabsContent value="freeform" className="mt-4 flex flex-col gap-3">
                  <Textarea
                    placeholder="Describe your video... e.g., 'A person excitedly unboxing a product and showing it to camera'"
                    value={store.freeformPrompt}
                    onChange={(e) => store.setFreeformPrompt(e.target.value)}
                    className="min-h-[140px] resize-y"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAutoGenerateFreeform}
                    disabled={!canAutoGenerate || generateScript.isPending}
                    className="self-start"
                  >
                    {generateScript.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Wand2 className="size-4" />
                    )}
                    Generate with AI
                  </Button>
                  {!canAutoGenerate && (
                    <p className="text-xs text-muted-foreground">
                      Select a persona or product below to enable AI generation
                    </p>
                  )}
                </TabsContent>

                {/* Structured tab */}
                <TabsContent value="structured" className="mt-4">
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Hook
                      </Label>
                      <Textarea
                        placeholder="Attention-grabbing opening (e.g., 'Stop scrolling! This changed my morning routine...')"
                        value={store.structuredScript?.hook ?? ""}
                        onChange={(e) =>
                          store.updateStructuredField("hook", e.target.value)
                        }
                        className="min-h-[72px] resize-y"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        Body
                      </Label>
                      <Textarea
                        placeholder="Main content showing the product or service in action"
                        value={store.structuredScript?.body ?? ""}
                        onChange={(e) =>
                          store.updateStructuredField("body", e.target.value)
                        }
                        className="min-h-[88px] resize-y"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">
                        CTA
                      </Label>
                      <Textarea
                        placeholder="Call to action (e.g., 'Link in bio — use code SAVE20 for 20% off!')"
                        value={store.structuredScript?.cta ?? ""}
                        onChange={(e) =>
                          store.updateStructuredField("cta", e.target.value)
                        }
                        className="min-h-[72px] resize-y"
                      />
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleAutoGenerate}
                      disabled={!canAutoGenerate || generateScript.isPending}
                      className="self-start"
                    >
                      {generateScript.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Wand2 className="size-4" />
                      )}
                      Auto-generate
                    </Button>
                    {!canAutoGenerate && store.scriptFormat === "structured" && (
                      <p className="text-xs text-muted-foreground">
                        Select a persona or product below to enable auto-generation
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Section 2: Reference Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reference Image</CardTitle>
              <CardDescription>
                Optionally provide an image to guide the video style
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Reference type selector — styled button group since no RadioGroup */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REFERENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => store.setReferenceType(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-center transition-all text-sm",
                      store.referenceType === opt.value
                        ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <span className="font-medium text-xs">{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Custom Upload */}
              {store.referenceType === "custom" && (
                <div className="flex flex-col gap-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    {uploadImage.isPending ? (
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    ) : (
                      <Upload className="size-6 text-muted-foreground" />
                    )}
                    <p className="text-sm text-muted-foreground">
                      {uploadImage.isPending
                        ? "Uploading..."
                        : "Drop an image here or click to browse"}
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      JPEG, PNG, or WebP up to 10MB
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                  {customPreviewUrl && (
                    <div className="relative w-fit">
                      <img
                        src={customPreviewUrl}
                        alt="Custom reference"
                        className="h-24 w-24 rounded-lg object-cover border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customPreviewUrl?.startsWith("blob:")) {
                            URL.revokeObjectURL(customPreviewUrl);
                          }
                          setCustomPreviewUrl(null);
                          store.setCustomReferenceImagePath(null);
                          store.setCustomReferencePreviewUrl(null);
                        }}
                        className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-destructive text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Persona Image */}
              {store.referenceType === "persona" && (
                <div className="flex flex-col gap-3">
                  <Label className="text-xs text-muted-foreground">
                    Select Persona
                  </Label>
                  <Select
                    value={store.personaId ?? ""}
                    onValueChange={(v) => store.setPersonaId(v || null)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a persona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {personasLoading && (
                        <SelectItem value="_loading" disabled>
                          Loading...
                        </SelectItem>
                      )}
                      {personas?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <User className="size-3.5 text-muted-foreground" />
                          {p.name}
                        </SelectItem>
                      ))}
                      {!personasLoading && (!personas || personas.length === 0) && (
                        <SelectItem value="_none" disabled>
                          No personas created yet
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {selectedPersona && personaImageUrl && (
                    <img
                      src={personaImageUrl}
                      alt={selectedPersona.name}
                      className="h-24 w-24 rounded-lg object-cover border border-border"
                    />
                  )}
                </div>
              )}

              {/* Composite (Persona + Product) */}
              {store.referenceType === "composite" && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Persona picker */}
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Persona
                      </Label>
                      <Select
                        value={store.personaId ?? ""}
                        onValueChange={(v) => store.setPersonaId(v || null)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a persona..." />
                        </SelectTrigger>
                        <SelectContent>
                          {personasLoading && (
                            <SelectItem value="_loading" disabled>
                              Loading...
                            </SelectItem>
                          )}
                          {personas?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <User className="size-3.5 text-muted-foreground" />
                              {p.name}
                            </SelectItem>
                          ))}
                          {!personasLoading &&
                            (!personas || personas.length === 0) && (
                              <SelectItem value="_none" disabled>
                                No personas yet
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                      {selectedPersona && personaImageUrl && (
                        <img
                          src={personaImageUrl}
                          alt={selectedPersona.name}
                          className="h-16 w-16 rounded-lg object-cover border border-border"
                        />
                      )}
                    </div>

                    {/* Product picker */}
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Product
                      </Label>
                      <Select
                        value={store.productId ?? ""}
                        onValueChange={(v) => store.setProductId(v || null)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a product..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productsLoading && (
                            <SelectItem value="_loading" disabled>
                              Loading...
                            </SelectItem>
                          )}
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              <Package className="size-3.5 text-muted-foreground" />
                              {p.name}
                            </SelectItem>
                          ))}
                          {!productsLoading &&
                            (!products || products.length === 0) && (
                              <SelectItem value="_none" disabled>
                                No products yet
                              </SelectItem>
                            )}
                        </SelectContent>
                      </Select>
                      {selectedProduct && productImageUrl && (
                        <img
                          src={productImageUrl}
                          alt={selectedProduct.name}
                          className="h-16 w-16 rounded-lg object-cover border border-border"
                        />
                      )}
                    </div>
                  </div>

                  {/* SaaS toggle */}
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={store.isSaas}
                      onCheckedChange={store.setIsSaas}
                    />
                    <Label className="text-sm cursor-pointer">
                      SaaS product (screen demo style)
                    </Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 3: Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Model */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <Select
                    value={store.soraModel}
                    onValueChange={(v) => store.setSoraModel(v as SoraModel)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sora-2">
                        Standard (sora-2)
                      </SelectItem>
                      <SelectItem value="sora-2-pro">
                        Pro (sora-2-pro)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Duration
                  </Label>
                  <Select
                    value={String(store.duration)}
                    onValueChange={(v) =>
                      store.setDuration(Number(v) as 4 | 8 | 12 | 16 | 20)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4 seconds</SelectItem>
                      <SelectItem value="8">8 seconds</SelectItem>
                      <SelectItem value="12">12 seconds</SelectItem>
                      <SelectItem value="16">16 seconds</SelectItem>
                      <SelectItem value="20">20 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Language
                  </Label>
                  <Select
                    value={store.language}
                    onValueChange={store.setLanguage}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Persona & Product context (when not using composite — useful for script gen) */}
          {store.referenceType !== "composite" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Context (optional)</CardTitle>
                <CardDescription>
                  Select a persona and/or product to improve script generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Persona
                    </Label>
                    <Select
                      value={store.personaId ?? "__none__"}
                      onValueChange={(v) => store.setPersonaId(v === "__none__" ? null : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {personas?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <User className="size-3.5 text-muted-foreground" />
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Product
                    </Label>
                    <Select
                      value={store.productId ?? "__none__"}
                      onValueChange={(v) => store.setProductId(v === "__none__" ? null : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {products?.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <Package className="size-3.5 text-muted-foreground" />
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ============================================================= */}
        {/* RIGHT PANEL — Preview & Generation                             */}
        {/* ============================================================= */}
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-6 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Preview</CardTitle>
                  <Badge variant="accent">
                    <Sparkles className="size-3" />
                    {cost} credits
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {/* Preview area */}
                <div className="relative aspect-[9/16] w-full max-w-[320px] mx-auto rounded-xl overflow-hidden border border-border bg-gradient-to-br from-muted/40 to-muted/80">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Reference preview"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground/50">
                      <Video className="size-12" />
                      <p className="text-sm text-center px-4">
                        {store.referenceType === "none"
                          ? "No reference image selected"
                          : "Select an option to see preview"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Model</span>
                    <span className="text-foreground font-medium">
                      {store.soraModel === "sora-2-pro" ? "Pro" : "Standard"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-muted-foreground">
                    <span>Duration</span>
                    <span className="text-foreground font-medium">
                      {store.duration}s
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-muted-foreground">
                    <span>Reference</span>
                    <span className="text-foreground font-medium capitalize">
                      {store.referenceType}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-muted-foreground">
                    <span>Script</span>
                    <span className="text-foreground font-medium">
                      {hasScript ? "Ready" : "Not set"}
                    </span>
                  </div>
                  {credits && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-muted-foreground">
                        <span>Your credits</span>
                        <span className="text-foreground font-medium">
                          {credits.is_unlimited
                            ? "Unlimited"
                            : credits.remaining}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Generate button */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={!hasScript || isGenerating || !hasEnoughCredits}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Video className="size-4" />
                      Generate Video &mdash; {cost} credits
                    </>
                  )}
                </Button>

                {!hasEnoughCredits && credits && (
                  <p className="text-xs text-destructive text-center">
                    Not enough credits. You need {cost} but have{" "}
                    {credits.remaining}.
                  </p>
                )}

                {isGenerating && (
                  <div className="flex flex-col gap-2">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-primary rounded-full animate-pulse" />
                    </div>
                    <p className="text-xs text-muted-foreground text-center animate-pulse">
                      {generateScript.isPending
                        ? "Generating script..."
                        : submitVideo.isPending
                          ? "Submitting video..."
                          : "Starting generation..."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
