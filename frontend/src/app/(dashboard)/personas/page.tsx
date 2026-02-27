"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Users, User, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useDeletePersona,
  usePersonas,
  resolvePersonaImageUrl,
} from "@/hooks/use-personas";
import { useProfile, PERSONA_SLOT_LIMITS } from "@/hooks/use-profile";
import type { Persona } from "@/types/database";

/** Resolve image URLs for a list of personas (handles storage paths). */
function useResolvedImages(personas: Persona[] | undefined) {
  const [imageMap, setImageMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (!personas || personas.length === 0) return;

    let cancelled = false;
    async function resolve() {
      const entries = await Promise.all(
        personas!.map(async (p) => {
          const url = await resolvePersonaImageUrl(p.selected_image_url);
          return [p.id, url] as [string, string | null];
        })
      );
      if (!cancelled) {
        setImageMap(Object.fromEntries(entries));
      }
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [personas]);

  return imageMap;
}

function PersonaCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col items-center gap-4">
        <Skeleton className="size-24 rounded-full" />
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PersonasPage() {
  const { data: personas, isLoading: personasLoading, error: personasError } = usePersonas();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const imageMap = useResolvedImages(personas);
  const [personaToDelete, setPersonaToDelete] = useState<Persona | null>(null);
  const deleteMutation = useDeletePersona(personaToDelete?.id ?? "");

  const isLoading = personasLoading || profileLoading;
  const plan = profile?.plan ?? "free";
  const isAdmin = profile?.role === "admin";
  const slotLimit = PERSONA_SLOT_LIMITS[plan];
  const slotsUsed = personas?.length ?? 0;
  const atLimit = !isAdmin && slotsUsed >= slotLimit;
  const hasPersonas = (personas?.length ?? 0) > 0;

  function handleDeletePersona() {
    if (!personaToDelete) return;

    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Persona deleted successfully");
        setPersonaToDelete(null);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete persona");
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Personas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              isAdmin
                ? `${slotsUsed} personas created · unlimited slots (admin)`
                : `${slotsUsed}/${slotLimit} persona slots used`
            )}
          </p>
        </div>
        {atLimit ? (
          <Button disabled>
            <Plus className="size-4" />
            Create Persona
          </Button>
        ) : (
          <Button asChild>
            <Link href="/personas/new">
              <Plus className="size-4" />
              Create Persona
            </Link>
          </Button>
        )}
      </div>

      {/* Error state */}
      {personasError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">
              Failed to load personas. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PersonaCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Persona Grid */}
      {!isLoading && !personasError && hasPersonas && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {personas!.map((persona) => {
            const resolvedUrl = imageMap[persona.id];
            const attrs = persona.attributes;

            return (
              <Card key={persona.id} className="h-full transition-colors hover:border-primary/30">
                <CardContent className="flex flex-col items-center gap-4 p-6">
                  {/* Avatar / Image */}
                  <div className="flex size-24 items-center justify-center rounded-full bg-muted">
                    {resolvedUrl ? (
                      <img
                        src={resolvedUrl}
                        alt={persona.name}
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      <User className="size-10 text-muted-foreground" />
                    )}
                  </div>

                  {/* Name & Info */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold">
                      {persona.name}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {attrs.gender} / {attrs.age}
                    </p>
                  </div>

                  {/* Attribute Badges */}
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {attrs.hair_color && (
                      <Badge variant="secondary" className="text-xs">
                        {attrs.hair_color} hair
                      </Badge>
                    )}
                    {attrs.body_type && (
                      <Badge variant="secondary" className="text-xs">
                        {attrs.body_type}
                      </Badge>
                    )}
                    {attrs.clothing_style && (
                      <Badge variant="secondary" className="text-xs">
                        {attrs.clothing_style}
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <div className="flex items-center justify-center gap-2 px-6 pb-6">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/personas/${persona.id}`}>View</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setPersonaToDelete(persona)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!personaToDelete}
        onOpenChange={(open) => {
          if (!open) setPersonaToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete persona</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{personaToDelete?.name}&quot;?
              This persona will no longer appear in your library, but existing
              generations will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPersonaToDelete(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePersona}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Persona"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {!isLoading && !personasError && !hasPersonas && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Create your first AI persona</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Build a custom AI avatar to star in your UGC video ads.
                Customize appearance, style, and more.
              </p>
            </div>
            <Button asChild>
              <Link href="/personas/new">
                <Plus className="size-4" />
                Create Persona
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
