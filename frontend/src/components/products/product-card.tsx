"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pencil, Check, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { ScrapeProduct } from "@/types/api";

interface ProductCardProps {
  product: ScrapeProduct;
  editable?: boolean;
  onEdit?: (updated: ScrapeProduct) => void;
}

export function ProductCard({ product, editable = false, onEdit }: ProductCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState({
    name: product.name,
    price: product.price,
    description: product.description,
  });

  const primaryImage = product.images[0] ?? null;

  function handleSave() {
    onEdit?.({
      ...product,
      name: editState.name,
      price: editState.price,
      description: editState.description,
    });
    setIsEditing(false);
  }

  function handleCancel() {
    setEditState({
      name: product.name,
      price: product.price,
      description: product.description,
    });
    setIsEditing(false);
  }

  return (
    <Card className="overflow-hidden border-white/5 bg-zinc-900/40">
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-zinc-800/50">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-12 text-zinc-600" />
          </div>
        )}
        {/* Source badge */}
        <Badge
          className={cn(
            "absolute top-2 right-2 text-[10px]",
            product.source === "shopify"
              ? "bg-green-600/80 text-white hover:bg-green-600/80"
              : "bg-zinc-600/80 text-white hover:bg-zinc-600/80"
          )}
        >
          {product.source === "shopify" ? "Shopify" : "Generic"}
        </Badge>
      </div>

      <CardContent className="space-y-3 pt-4">
        {isEditing ? (
          /* Edit mode */
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Name</label>
              <Input
                value={editState.name}
                onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                className="h-8 border-white/10 bg-zinc-800/50 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Price ({product.currency})</label>
              <Input
                type="number"
                step="0.01"
                value={editState.price ?? ""}
                onChange={(e) =>
                  setEditState((s) => ({
                    ...s,
                    price: e.target.value === "" ? null : parseFloat(e.target.value),
                  }))
                }
                className="h-8 border-white/10 bg-zinc-800/50 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Description</label>
              <Textarea
                value={editState.description}
                onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
                rows={3}
                className="border-white/10 bg-zinc-800/50 text-sm text-white"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 gap-1 bg-violet-600 text-xs text-white hover:bg-violet-500"
              >
                <Check className="size-3" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="h-7 gap-1 text-xs text-zinc-400 hover:text-white"
              >
                <X className="size-3" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Display mode */
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-2 text-sm font-medium text-white">{product.name}</h3>
              {editable && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Edit product"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
            {product.price !== null && (
              <p className="text-sm font-semibold text-violet-400">
                {formatCurrency(product.price, product.currency)}
              </p>
            )}
            {product.description && (
              <p className="line-clamp-3 text-xs text-zinc-500">{product.description}</p>
            )}
            {product.category && (
              <Badge variant="outline" className="text-[10px] text-zinc-400 border-white/10">
                {product.category}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
