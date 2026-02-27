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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PLANS, CREDITS_PER_BATCH, type PlanTier } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGenerationWizardStore } from "@/stores/generation-wizard";
import { useProducts } from "@/hooks/use-products";
import { usePersonas } from "@/hooks/use-personas";
import { useCredits } from "@/hooks/use-credits";
import { useCreateGeneration } from "@/hooks/use-generations";
import { useCheckout } from "@/hooks/use-checkout";

const steps = [
  { number: 1, label: "Product" },
  { number: 2, label: "Persona" },
  { number: 3, label: "Review" },
];

export default function GeneratePage() {
  const router = useRouter();
  const store = useGenerationWizardStore();
  const [showPaywall, setShowPaywall] = useState(false);

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: personas, isLoading: personasLoading } = usePersonas();
  const { data: credits, isLoading: creditsLoading } = useCredits();
  const createGeneration = useCreateGeneration();
  const checkout = useCheckout();

  const confirmedProducts = products?.filter((p) => p.confirmed) ?? [];
  const activePersonas = personas ?? [];

  const selectedProduct = confirmedProducts.find((p) => p.id === store.productId);
  const selectedPersona = activePersonas.find((p) => p.id === store.personaId);

  const creditsRemaining = credits?.remaining ?? 0;
  const hasEnoughCredits = creditsRemaining >= CREDITS_PER_BATCH;

  function handleNext() {
    if (store.step < 3) store.setStep(store.step + 1);
  }

  function handleBack() {
    if (store.step > 1) store.setStep(store.step - 1);
  }

  function canProceed() {
    switch (store.step) {
      case 1:
        return !!store.productId;
      case 2:
        return !!store.personaId;
      case 3:
        return true;
      default:
        return false;
    }
  }

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
        mode: store.mode as "easy" | "expert",
      },
      {
        onSuccess: (generation) => {
          store.reset();
          router.push(`/dashboard/generate/${generation.id}`);
          toast.success("Generation started!");
        },
        onError: (err) => {
          toast.error(err.message || "Failed to start generation");
        },
      }
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Generate UGC Video
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create AI-powered video ads in 3 simple steps.
          {!creditsLoading && (
            <span className="ml-2 font-medium text-foreground">
              {creditsRemaining} credits remaining
            </span>
          )}
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
            {productsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            ) : confirmedProducts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <Package className="size-10 text-muted-foreground" />
                  <div className="text-center">
                    <h3 className="font-semibold text-foreground">
                      No products yet
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Import products from your store first.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/products">Import Products</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
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
                          ? "border-violet-500 ring-1 ring-violet-500/30"
                          : "hover:border-muted-foreground/30"
                      )}
                    >
                      <CardContent className="flex flex-col gap-3">
                        <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                          {product.images?.[0] ? (
                            <img
                              src={product.images[0]}
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
                          {product.price && (
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {product.currency === "USD" ? "$" : product.currency}
                              {product.price}
                            </p>
                          )}
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
            )}
          </div>
        )}

        {/* Step 2: Select Persona */}
        {store.step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Select a Persona
            </h2>
            {personasLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2].map((i) => (
                  <Card key={i} className="h-48 animate-pulse bg-muted" />
                ))}
              </div>
            ) : activePersonas.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <User className="size-10 text-muted-foreground" />
                  <div className="text-center">
                    <h3 className="font-semibold text-foreground">
                      No personas yet
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create an AI persona first.
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/personas/new">Create Persona</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
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
                          ? "border-violet-500 ring-1 ring-violet-500/30"
                          : "hover:border-muted-foreground/30"
                      )}
                    >
                      <CardContent className="flex flex-col items-center gap-3 py-6">
                        <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                          {persona.selected_image_url ? (
                            <img
                              src={persona.selected_image_url}
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
                            {persona.attributes.gender} / {persona.attributes.age} / {persona.attributes.clothing_style}
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
            )}
          </div>
        )}

        {/* Step 3: Review & Generate */}
        {store.step === 3 && (
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

                  {/* Mode */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mode</span>
                    <Badge variant="secondary" className="capitalize">
                      {store.mode}
                    </Badge>
                  </div>

                  {/* Generation Info */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        What you will get
                      </p>
                      <p className="text-xs text-muted-foreground">
                        3 Hook + 3 Body + 3 CTA segments = 27 combinations
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-violet-400">
                        {CREDITS_PER_BATCH}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        credits cost
                      </p>
                    </div>
                  </div>

                  {!hasEnoughCredits && !creditsLoading && (
                    <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
                      You need {CREDITS_PER_BATCH} credits but have{" "}
                      {creditsRemaining}. Subscribe or upgrade to continue.
                    </div>
                  )}
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

        {store.step < 3 ? (
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
            disabled={createGeneration.isPending}
            className="bg-violet-600 hover:bg-violet-700"
            size="lg"
          >
            {createGeneration.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Generate Video
              </>
            )}
          </Button>
        )}
      </div>

      {/* Paywall Dialog */}
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
                ? `You need ${CREDITS_PER_BATCH} credits but have ${creditsRemaining}. Upgrade your plan for more credits.`
                : "Choose a plan to start generating UGC videos."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            {(Object.entries(PLANS) as [PlanTier, (typeof PLANS)[PlanTier]][]).map(
              ([key, plan]) => (
                <div
                  key={key}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-4 py-3",
                    key === "growth"
                      ? "border-violet-500/50 bg-violet-500/5"
                      : "border-border"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{plan.name}</p>
                      {key === "growth" && (
                        <Badge
                          variant="secondary"
                          className="bg-violet-500/10 text-violet-400 text-xs"
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
                    <span className="font-semibold text-foreground">
                      ${plan.price}/mo
                    </span>
                    <Button
                      size="sm"
                      variant={key === "growth" ? "default" : "outline"}
                      className={
                        key === "growth"
                          ? "bg-violet-600 hover:bg-violet-700"
                          : ""
                      }
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
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
