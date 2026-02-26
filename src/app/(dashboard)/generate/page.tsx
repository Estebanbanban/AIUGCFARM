"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImageIcon,
  Loader2,
  Package,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGenerationWizardStore } from "@/stores/generation-wizard";

const mockProducts = [
  {
    id: "prod-1",
    name: "Vitamin C Serum",
    brand: "GlowSkin Cosmetics",
    price: "$29.99",
    image: null as string | null,
  },
  {
    id: "prod-2",
    name: "Hyaluronic Acid Moisturizer",
    brand: "GlowSkin Cosmetics",
    price: "$34.99",
    image: null as string | null,
  },
  {
    id: "prod-3",
    name: "Protein Shake Mix",
    brand: "FitFuel Nutrition",
    price: "$49.99",
    image: null as string | null,
  },
];

const mockPersonas = [
  {
    id: "persona-1",
    name: "Sophie",
    gender: "Female",
    age: "25-35",
    style: "Casual",
    image: null as string | null,
  },
  {
    id: "persona-2",
    name: "Marcus",
    gender: "Male",
    age: "25-35",
    style: "Sporty",
    image: null as string | null,
  },
];

const mockSubscription = {
  tier: "growth",
  creditsRemaining: 18,
  creditsTotal: 27,
};

const steps = [
  { number: 1, label: "Product" },
  { number: 2, label: "Persona" },
  { number: 3, label: "Configure" },
  { number: 4, label: "Review" },
];

export default function GeneratePage() {
  const router = useRouter();
  const store = useGenerationWizardStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const hasSubscription = mockSubscription.tier !== "none";
  const totalSegments = store.hookCount + store.bodyCount + store.ctaCount;
  const totalCombinations =
    store.hookCount * store.bodyCount * store.ctaCount;
  const creditCost = totalSegments;

  const selectedProduct = mockProducts.find((p) => p.id === store.productId);
  const selectedPersona = mockPersonas.find((p) => p.id === store.personaId);

  function handleNext() {
    if (store.step < 4) {
      store.setStep(store.step + 1);
    }
  }

  function handleBack() {
    if (store.step > 1) {
      store.setStep(store.step - 1);
    }
  }

  function canProceed() {
    switch (store.step) {
      case 1:
        return !!store.productId;
      case 2:
        return !!store.personaId;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  }

  async function handleGenerate() {
    if (!hasSubscription) {
      setShowPaywall(true);
      return;
    }

    setIsSubmitting(true);
    // Simulate creating a segment batch
    setTimeout(() => {
      const mockBatchId = "batch-new-1";
      store.reset();
      router.push(`/dashboard/generate/${mockBatchId}`);
    }, 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Generate UGC Video
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create AI-powered video ads in 4 simple steps.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {steps.map((s, i) => (
          <div key={s.number} className="flex items-center gap-2 sm:gap-4">
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
                    ? "bg-violet-600 text-white"
                    : store.step > s.number
                      ? "bg-violet-600/20 text-violet-400"
                      : "bg-muted text-muted-foreground"
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
                    : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  store.step > s.number ? "bg-violet-500" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Select Product */}
        {store.step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Select a Product
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mockProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => store.setProductId(product.id)}
                  className="text-left"
                >
                  <Card
                    className={cn(
                      "h-full transition-all",
                      store.productId === product.id
                        ? "border-violet-500 ring-1 ring-violet-500/30"
                        : "hover:border-muted-foreground/30"
                    )}
                  >
                    <CardContent className="flex flex-col gap-3">
                      <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="size-full rounded-lg object-cover"
                          />
                        ) : (
                          <ImageIcon className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {product.brand}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {product.price}
                        </p>
                      </div>
                      {store.productId === product.id && (
                        <div className="flex items-center gap-1.5 text-xs text-violet-400">
                          <Check className="size-3.5" />
                          Selected
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Select Persona */}
        {store.step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Select a Persona
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {mockPersonas.map((persona) => (
                <button
                  key={persona.id}
                  onClick={() => store.setPersonaId(persona.id)}
                  className="text-left"
                >
                  <Card
                    className={cn(
                      "h-full transition-all",
                      store.personaId === persona.id
                        ? "border-violet-500 ring-1 ring-violet-500/30"
                        : "hover:border-muted-foreground/30"
                    )}
                  >
                    <CardContent className="flex flex-col items-center gap-3 py-6">
                      <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                        {persona.image ? (
                          <img
                            src={persona.image}
                            alt={persona.name}
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          <User className="size-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="text-center">
                        <h3 className="font-medium text-foreground">
                          {persona.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {persona.gender} / {persona.age} / {persona.style}
                        </p>
                      </div>
                      {store.personaId === persona.id && (
                        <div className="flex items-center gap-1.5 text-xs text-violet-400">
                          <Check className="size-3.5" />
                          Selected
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Configure Segments */}
        {store.step === 3 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-foreground">
              Configure Segments
            </h2>

            <div className="mx-auto w-full max-w-lg space-y-8">
              {/* Hooks */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">
                    Hooks
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    {store.hookCount}
                  </Badge>
                </div>
                <Slider
                  value={[store.hookCount]}
                  onValueChange={([v]) => store.setHookCount(v)}
                  min={1}
                  max={5}
                  step={1}
                  className="[&>[data-slot=slider-range]]:bg-violet-500 [&>[data-slot=slider-thumb]]:border-violet-500"
                />
                <p className="text-xs text-muted-foreground">
                  Opening hooks to grab attention
                </p>
              </div>

              {/* Bodies */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">
                    Bodies
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    {store.bodyCount}
                  </Badge>
                </div>
                <Slider
                  value={[store.bodyCount]}
                  onValueChange={([v]) => store.setBodyCount(v)}
                  min={1}
                  max={5}
                  step={1}
                  className="[&>[data-slot=slider-range]]:bg-violet-500 [&>[data-slot=slider-thumb]]:border-violet-500"
                />
                <p className="text-xs text-muted-foreground">
                  Main content segments showcasing the product
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">
                    CTAs
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    {store.ctaCount}
                  </Badge>
                </div>
                <Slider
                  value={[store.ctaCount]}
                  onValueChange={([v]) => store.setCtaCount(v)}
                  min={1}
                  max={5}
                  step={1}
                  className="[&>[data-slot=slider-range]]:bg-violet-500 [&>[data-slot=slider-thumb]]:border-violet-500"
                />
                <p className="text-xs text-muted-foreground">
                  Closing call-to-action segments
                </p>
              </div>

              <Separator />

              {/* Summary */}
              <Card className="border-violet-500/20 bg-violet-500/5">
                <CardContent className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Total segments
                    </span>
                    <span className="font-semibold text-foreground">
                      {totalSegments}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Possible combinations
                    </span>
                    <span className="font-semibold text-foreground">
                      {totalCombinations}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Credit cost</span>
                    <span className="font-bold text-violet-400">
                      {creditCost} credits
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 4: Review & Generate */}
        {store.step === 4 && (
          <div className="flex flex-col gap-6">
            <h2 className="text-lg font-semibold text-foreground">
              Review & Generate
            </h2>

            <div className="mx-auto w-full max-w-lg">
              <Card>
                <CardContent className="flex flex-col gap-4">
                  {/* Product */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <Package className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Product</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedProduct?.name || "Not selected"}
                      </p>
                    </div>
                  </div>

                  {/* Persona */}
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                      <User className="size-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Persona</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedPersona?.name || "Not selected"}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Segment Counts */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {store.hookCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Hooks</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {store.bodyCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Bodies</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">
                        {store.ctaCount}
                      </p>
                      <p className="text-xs text-muted-foreground">CTAs</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Credits */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Credit Cost
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totalSegments} segments = {totalCombinations} possible
                        combos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-violet-400">
                        {creditCost}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        of {mockSubscription.creditsRemaining} remaining
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={store.step === 1}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {store.step < 4 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="bg-violet-600 hover:bg-violet-700"
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={isSubmitting}
            className="bg-violet-600 hover:bg-violet-700"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Generate Segments
              </>
            )}
          </Button>
        )}
      </div>

      {/* Paywall Dialog */}
      <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Subscription Required</DialogTitle>
            <DialogDescription>
              You need an active subscription to generate UGC video segments.
              Choose a plan to get started.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {[
              {
                name: "Starter",
                price: "$29/mo",
                credits: "27 segments",
              },
              {
                name: "Growth",
                price: "$79/mo",
                credits: "100 segments",
              },
              {
                name: "Scale",
                price: "$199/mo",
                credits: "300 segments",
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div>
                  <p className="font-medium text-foreground">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.credits}/month
                  </p>
                </div>
                <span className="font-semibold text-foreground">
                  {plan.price}
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button asChild className="w-full bg-violet-600 hover:bg-violet-700">
              <Link href="/pricing">View Plans</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
