"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, Loader2, Images } from "lucide-react";
import { toast } from "sonner";
import { useCollections, useCreateCollection, useDeleteCollection } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CollectionCard } from "@/components/collections/CollectionCard";
import type { ImageCollection } from "@/types/slideshow";

function CollectionCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-3 p-4">
        <Skeleton className="aspect-square rounded-lg" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function CollectionsPage() {
  const router = useRouter();
  const { data: collections, isLoading, error } = useCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();

  // New collection dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  // Delete confirmation
  const [collectionToDelete, setCollectionToDelete] = useState<ImageCollection | null>(null);

  const hasCollections = (collections?.length ?? 0) > 0;

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await createCollection.mutateAsync({ name: newName.trim() });
      toast.success("Collection created!");
      setShowCreate(false);
      setNewName("");
      router.push(`/collections/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create collection");
    }
  }

  async function handleDelete() {
    if (!collectionToDelete) return;
    try {
      await deleteCollection.mutateAsync(collectionToDelete.id);
      toast.success(`"${collectionToDelete.name}" deleted`);
      setCollectionToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete collection");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Image Collections</h1>
          <span className="mt-1 block text-sm text-muted-foreground" suppressHydrationWarning>
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              `${collections?.length ?? 0} collection${(collections?.length ?? 0) !== 1 ? "s" : ""}`
            )}
          </span>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="size-4" />
          New Collection
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-destructive">
              Failed to load collections. Please try again later.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CollectionCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Collections grid */}
      {!isLoading && !error && hasCollections && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections!.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onClick={() => router.push(`/collections/${collection.id}`)}
              onDelete={() => setCollectionToDelete(collection)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !hasCollections && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Images className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Create your first collection</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Organize your images into collections to use in TikTok slideshows.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4" />
              New Collection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Collection Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            setNewName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Collection</DialogTitle>
            <DialogDescription>
              Create a collection to organize your slideshow images.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="collection-name">Collection Name</Label>
              <Input
                id="collection-name"
                placeholder="Product Photos"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || createCollection.isPending}
              >
                {createCollection.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Create Collection"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!collectionToDelete}
        onOpenChange={(open) => {
          if (!open) setCollectionToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{collectionToDelete?.name}&quot;?
              All images in this collection will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectionToDelete(null)}
              disabled={deleteCollection.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCollection.isPending}
            >
              {deleteCollection.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Collection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
