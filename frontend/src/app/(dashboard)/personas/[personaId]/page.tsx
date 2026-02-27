"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  Pencil,
  Sparkles,
  Clock,
  Video,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  usePersona,
  useDeletePersona,
  usePersonaGenerations,
  resolvePersonaImageUrl,
} from "@/hooks/use-personas";
import { usePersonaBuilderStore } from "@/stores/persona-builder";
import type { PersonaAttributes } from "@/types/database";

/** Resolve a single persona image URL (handles storage paths). */
function useResolvedImage(url: string | null | undefined) {
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolvePersonaImageUrl(url ?? null).then((r) => {
      if (!cancelled) setResolved(r);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return resolved;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildAttributeList(attrs: PersonaAttributes) {
  return [
    { label: "Gender", value: attrs.gender },
    { label: "Age Range", value: attrs.age },
    { label: "Hair Color", value: attrs.hair_color },
    { label: "Hair Style", value: attrs.hair_style },
    { label: "Eye Color", value: attrs.eye_color },
    { label: "Body Type", value: attrs.body_type },
    { label: "Clothing Style", value: attrs.clothing_style },
  ].filter((a) => a.value);
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Image card skeleton */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4">
            <Skeleton className="size-48 rounded-xl" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>

        {/* Details skeleton */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-28 rounded-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PersonaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const personaId = params.personaId as string;

  const {
    data: persona,
    isLoading: personaLoading,
    error: personaError,
  } = usePersona(personaId);

  const { data: generations, isLoading: generationsLoading } =
    usePersonaGenerations(personaId);

  const deleteMutation = useDeletePersona(personaId);
  const resolvedImage = useResolvedImage(persona?.selected_image_url);
  const builderStore = usePersonaBuilderStore();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  function handleEditRegenerate() {
    if (!persona) return;
    builderStore.initFromPersona(persona);
    router.push("/personas/new");
  }

  function handleDelete() {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Persona deleted successfully");
        setDeleteDialogOpen(false);
        router.push("/personas");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete persona");
      },
    });
  }

  // Loading state
  if (personaLoading) {
    return <DetailSkeleton />;
  }

  // 404 / Error state
  if (personaError || !persona) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/personas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Persona not found
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <User className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              This persona does not exist or has been deleted.
            </p>
            <Button asChild variant="outline">
              <Link href="/personas">Back to Personas</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const attrs = persona.attributes;
  const attributes = buildAttributeList(attrs);
  const accessories = attrs.accessories ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/personas">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {persona.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Delete button with confirmation dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete persona</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete &quot;{persona.name}&quot;? This
                  persona will no longer appear in your library, but existing
                  generations will not be affected.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={deleteMutation.isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete Persona"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={handleEditRegenerate}>
            <Pencil className="size-4" />
            Edit &amp; Regenerate
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Persona Image */}
        <Card>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex size-48 items-center justify-center rounded-xl bg-muted">
              {resolvedImage ? (
                <img
                  src={resolvedImage}
                  alt={persona.name}
                  className="size-full rounded-xl object-cover"
                />
              ) : (
                <User className="size-16 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-foreground">
                {persona.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Created {formatDate(persona.created_at)}
              </p>
            </div>

            {/* Skin Tone */}
            {attrs.skin_tone && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Skin Tone</span>
                <div
                  className="size-5 rounded-full border"
                  style={{ backgroundColor: attrs.skin_tone }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Persona Details */}
        <div className="flex flex-col gap-6">
          {/* Attributes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Attributes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {attributes.map((attr) => (
                  <Badge
                    key={attr.label}
                    variant="secondary"
                    className="gap-1.5 px-3 py-1.5 text-sm"
                  >
                    <span className="text-muted-foreground">{attr.label}:</span>
                    <span className="text-foreground">{attr.value}</span>
                  </Badge>
                ))}
              </div>

              {accessories.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Accessories
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {accessories.map((acc) => (
                      <Badge key={acc} variant="outline" className="text-xs">
                        {acc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Generations using this persona */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-foreground">
              Generations using this persona
            </h3>

            {generationsLoading && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-9 rounded-lg" />
                        <div className="flex flex-col gap-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-24" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!generationsLoading && generations && generations.length > 0 && (
              <div className="flex flex-col gap-3">
                {generations.map((gen) => (
                  <Link
                    key={gen.id}
                    href={`/generate/${gen.id}`}
                    className="group"
                  >
                    <Card className="transition-colors hover:border-violet-500/30">
                      <CardContent className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10">
                            <Video className="size-4 text-violet-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {gen.products?.name ?? "Unknown Product"}
                            </p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {gen.status.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatDate(gen.created_at)}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}

            {!generationsLoading &&
              (!generations || generations.length === 0) && (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-8">
                    <Sparkles className="size-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      No generations yet with this persona.
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      <Link href="/generate">
                        <Sparkles className="size-4" />
                        Generate Video
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
