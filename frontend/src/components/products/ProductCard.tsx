'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trash2, ImageIcon, Check } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isExternalUrl, getSignedImageUrl } from '@/lib/storage';
import type { Product } from '@/types/database';

const sourceBadgeStyles: Record<Product['source'], string> = {
  shopify: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
  generic: 'bg-gray-500/10 text-gray-500 dark:text-gray-400',
  manual: 'bg-green-500/10 text-green-500 dark:text-green-400',
};

interface ProductCardProps {
  product: Product;
  onDelete?: (id: string) => void;
}

export function ProductCard({ product, onDelete }: ProductCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string>('');

  // Resolve first image — handles external URLs and storage paths
  useEffect(() => {
    const firstImage = product.images?.[0];
    if (!firstImage) {
      setResolvedImage('');
      return;
    }
    if (isExternalUrl(firstImage)) {
      setResolvedImage(firstImage);
      return;
    }
    let cancelled = false;
    getSignedImageUrl('product-images', firstImage).then((url) => {
      if (!cancelled) setResolvedImage(url);
    });
    return () => { cancelled = true; };
  }, [product.images]);

  return (
    <>
      <Link href={`/products/${product.id}`} className="group/card block">
        <Card className="group h-full transition-colors hover:border-violet-500/30">
          <CardContent className="flex flex-col gap-3">
            {/* Product Image */}
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted">
              {resolvedImage ? (
                <img
                  src={resolvedImage}
                  alt={product.name}
                  className="size-full rounded-lg object-cover"
                />
              ) : (
                <ImageIcon className="size-8 text-muted-foreground" />
              )}

              {/* Delete button on hover */}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                >
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>

            {/* Product Name */}
            <h3 className="line-clamp-2 font-medium text-foreground">
              {product.name}
            </h3>

            {/* Price */}
            {product.price != null && (
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(product.price, product.currency)}
              </p>
            )}

            {/* Badges Row */}
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn('text-xs capitalize', sourceBadgeStyles[product.source])}
              >
                {product.source}
              </Badge>
              {product.confirmed ? (
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-xs text-emerald-500 dark:text-emerald-400"
                >
                  <Check className="size-3" />
                  Confirmed
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/10 text-xs text-amber-500 dark:text-amber-400"
                >
                  Pending
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{product.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => onDelete?.(product.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
