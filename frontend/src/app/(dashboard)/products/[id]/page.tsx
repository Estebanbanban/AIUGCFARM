"use client";

export const dynamic = "force-dynamic";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImageIcon,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  Tag,
  Calendar,
  DollarSign,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/use-products";
import { isExternalUrl, getSignedImageUrl, getSignedImageUrls } from "@/lib/storage";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Product } from "@/types/database";

/** Resolve all image URLs for a product. */
function useResolvedProductImages(product: Product | undefined) {
  const [resolvedImages, setResolvedImages] = useState<string[]>([]);

  useEffect(() => {
    if (!product?.images || product.images.length === 0) {
      setResolvedImages([]);
      return;
    }

    let cancelled = false;

    async function resolve() {
      const externalImages: string[] = [];
      const storagePaths: string[] = [];
      const indexMap: { type: "external" | "storage"; idx: number }[] = [];

      product!.images.forEach((img) => {
        if (isExternalUrl(img)) {
          indexMap.push({ type: "external", idx: externalImages.length });
          externalImages.push(img);
        } else {
          indexMap.push({ type: "storage", idx: storagePaths.length });
          storagePaths.push(img);
        }
      });

      const signedUrls =
        storagePaths.length > 0
          ? await getSignedImageUrls("product-images", storagePaths)
          : [];

      const result = indexMap.map((m) =>
        m.type === "external" ? externalImages[m.idx] : signedUrls[m.idx]
      );

      if (!cancelled) setResolvedImages(result);
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [product]);

  return resolvedImages;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: product, isLoading, error } = useProduct(id);
  const updateProduct = useUpdateProduct(id);
  const deleteProduct = useDeleteProduct(id);

  const resolvedImages = useResolvedProductImages(product);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // Sync edit fields when product loads or changes
  useEffect(() => {
    if (product) {
      setEditName(product.name);
      setEditDescription(product.description ?? "");
      setEditPrice(product.price != null ? String(product.price) : "");
    }
  }, [product]);

  const handleSave = useCallback(() => {
    const updates: Record<string, unknown> = {};
    if (editName !== product?.name) updates.name = editName;
    if (editDescription !== (product?.description ?? ""))
      updates.description = editDescription || undefined;
    if (editPrice !== (product?.price != null ? String(product.price) : "")) {
      updates.price = editPrice ? parseFloat(editPrice) : undefined;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    updateProduct.mutate(updates, {
      onSuccess: () => {
        toast.success("Product updated successfully");
        setIsEditing(false);
      },
      onError: (err) => {
        toast.error(err.message || "Failed to update product");
      },
    });
  }, [editName, editDescription, editPrice, product, updateProduct]);

  function handleDelete() {
    deleteProduct.mutate(undefined, {
      onSuccess: () => {
        toast.success("Product deleted");
        router.push("/products");
      },
      onError: (err) => {
        toast.error(err.message || "Failed to delete product");
      },
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-5 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Products
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <p className="text-sm text-destructive">
              {error?.message || "Product not found."}
            </p>
            <Button asChild variant="outline">
              <Link href="/products">Go to Products</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mainImage = resolvedImages[selectedImageIndex] || null;

  return (
    <div className="flex flex-col gap-6">
      {/* Back link + actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Products
        </Link>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditing(false);
                  setEditName(product.name);
                  setEditDescription(product.description ?? "");
                  setEditPrice(product.price != null ? String(product.price) : "");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700"
                onClick={handleSave}
                disabled={updateProduct.isPending || !editName.trim()}
              >
                {updateProduct.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Product</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &ldquo;{product.name}&rdquo;?
                  This action cannot be undone and will remove all associated
                  images and data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteProduct.isPending}
                >
                  {deleteProduct.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Image section */}
        <div className="flex flex-col gap-3">
          {/* Main image */}
          <div className="flex aspect-square items-center justify-center rounded-lg bg-muted overflow-hidden">
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.name}
                className="size-full object-contain"
              />
            ) : (
              <ImageIcon className="size-16 text-muted-foreground" />
            )}
          </div>

          {/* Thumbnail grid */}
          {resolvedImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {resolvedImages.map((imgUrl, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`flex size-16 shrink-0 items-center justify-center rounded-md border-2 bg-muted overflow-hidden transition-colors ${
                    i === selectedImageIndex
                      ? "border-violet-500"
                      : "border-transparent hover:border-muted-foreground/30"
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${product.name} ${i + 1}`}
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="flex flex-col gap-5">
          {/* Name */}
          {isEditing ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Product Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Product name"
              />
            </div>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {product.name}
            </h1>
          )}

          {/* Price */}
          {isEditing ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-price">Price ({product.currency})</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          ) : product.price != null ? (
            <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <DollarSign className="size-5 text-muted-foreground" />
              {formatCurrency(product.price, product.currency)}
            </div>
          ) : null}

          {/* Description */}
          {isEditing ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Product description..."
                rows={4}
              />
            </div>
          ) : product.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary" className="text-xs capitalize">
              {product.source}
            </Badge>
            {product.category && (
              <Badge variant="outline" className="text-xs">
                <Tag className="size-3" />
                {product.category}
              </Badge>
            )}
          </div>

          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4" />
              Added {formatDate(product.created_at)}
            </div>
            {product.store_url && (
              <a
                href={product.store_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-violet-500 hover:text-violet-400 transition-colors"
              >
                <ExternalLink className="size-4" />
                View in store
              </a>
            )}
          </div>

          {/* Brand Summary */}
          {product.brand_summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4" />
                  Brand Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {product.brand_summary.tone && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Tone
                    </span>
                    <p className="mt-0.5 text-sm text-foreground">
                      {product.brand_summary.tone}
                    </p>
                  </div>
                )}
                {product.brand_summary.demographic && (
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Target Demographic
                    </span>
                    <p className="mt-0.5 text-sm text-foreground">
                      {product.brand_summary.demographic}
                    </p>
                  </div>
                )}
                {product.brand_summary.selling_points &&
                  product.brand_summary.selling_points.length > 0 && (
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Key Selling Points
                      </span>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {product.brand_summary.selling_points.map((point, i) => (
                          <li
                            key={i}
                            className="text-sm text-foreground"
                          >
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
