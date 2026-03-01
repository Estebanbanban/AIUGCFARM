'use client';

import { useState } from 'react';
import { Check, Loader2, Pencil, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useConfirmProduct, useUpdateProduct } from '@/hooks/use-products';
import type { Product, BrandSummary } from '@/types/database';

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

interface ScrapeResultsProps {
  products: Product[];
  brandSummary?: BrandSummary | null;
  onConfirmed: () => void;
}

interface EditState {
  name: string;
  description: string;
  price: string;
}

export function ScrapeResults({
  products,
  brandSummary,
  onConfirmed,
}: ScrapeResultsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({
    name: '',
    description: '',
    price: '',
  });
  const [confirming, setConfirming] = useState(false);

  const confirmProduct = useConfirmProduct();

  function startEditing(product: Product) {
    setEditingId(product.id);
    setEditState({
      name: stripHtml(product.name),
      description: stripHtml(product.description ?? ''),
      price: product.price != null ? String(product.price) : '',
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditState({ name: '', description: '', price: '' });
  }

  async function handleConfirmAll() {
    setConfirming(true);
    try {
      await confirmProduct.mutateAsync({
        product_ids: products.map((p) => p.id),
      });
      toast.success('Products confirmed!');
      onConfirmed();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to confirm products';
      toast.error(message, {
        action: {
          label: 'Retry',
          onClick: () => handleConfirmAll(),
        },
      });
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Brand Summary */}
      {brandSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brand Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {brandSummary.tone && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Tone:
                </span>
                <Badge variant="secondary">
                  {Array.isArray(brandSummary.tone)
                    ? brandSummary.tone[0]
                    : brandSummary.tone}
                </Badge>
              </div>
            )}
            {brandSummary.demographic && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Demographic:
                </span>
                <Badge variant="secondary">
                  {brandSummary.demographic.length > 30
                    ? brandSummary.demographic.slice(0, 30) + '...'
                    : brandSummary.demographic}
                </Badge>
              </div>
            )}
            {brandSummary.selling_points &&
              brandSummary.selling_points.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Selling Points:
                  </span>
                  {brandSummary.selling_points.slice(0, 3).map((point, i) => (
                    <Badge key={i} variant="outline">
                      {point}
                    </Badge>
                  ))}
                  {brandSummary.selling_points.length > 3 && (
                    <Badge variant="outline">
                      +{brandSummary.selling_points.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Product Cards */}
      <div className="flex flex-col gap-4">
        {products.map((product) => {
          const isEditing = editingId === product.id;

          return (
            <ProductEditCard
              key={product.id}
              product={product}
              isEditing={isEditing}
              editState={editState}
              onEditStateChange={setEditState}
              onStartEditing={() => startEditing(product)}
              onCancelEditing={cancelEditing}
              onSaved={cancelEditing}
            />
          );
        })}
      </div>

      {/* Confirm All Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleConfirmAll}
          disabled={confirming}
          className="bg-primary hover:bg-primary/90"
        >
          {confirming ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Confirming...
            </>
          ) : (
            <>
              <Check className="size-4" />
              Confirm All
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface ProductEditCardProps {
  product: Product;
  isEditing: boolean;
  editState: EditState;
  onEditStateChange: (state: EditState) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  onSaved: () => void;
}

function ProductEditCard({
  product,
  isEditing,
  editState,
  onEditStateChange,
  onStartEditing,
  onCancelEditing,
  onSaved,
}: ProductEditCardProps) {
  const updateProduct = useUpdateProduct(product.id);

  async function handleSave() {
    try {
      await updateProduct.mutateAsync({
        name: editState.name,
        description: editState.description || undefined,
        price: editState.price ? parseFloat(editState.price) : undefined,
      });
      toast.success('Product updated');
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product';
      toast.error(message);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        {/* Image thumbnails */}
        <div className="flex shrink-0 gap-2">
          {product.images && product.images.length > 0 ? (
            product.images.slice(0, 3).map((img, i) => (
              <div
                key={i}
                className="size-16 overflow-hidden rounded-md bg-muted"
              >
                <img
                  src={img}
                  alt={`${stripHtml(product.name)} ${i + 1}`}
                  className="size-full object-cover"
                />
              </div>
            ))
          ) : (
            <div className="flex size-16 items-center justify-center rounded-md bg-muted">
              <ImageIcon className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex flex-1 flex-col gap-3">
          {isEditing ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`name-${product.id}`}>Name</Label>
                <Input
                  id={`name-${product.id}`}
                  value={editState.name}
                  onChange={(e) =>
                    onEditStateChange({ ...editState, name: e.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`desc-${product.id}`}>Description</Label>
                <Textarea
                  id={`desc-${product.id}`}
                  value={editState.description}
                  onChange={(e) =>
                    onEditStateChange({
                      ...editState,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`price-${product.id}`}>Price</Label>
                <Input
                  id={`price-${product.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  value={editState.price}
                  onChange={(e) =>
                    onEditStateChange({ ...editState, price: e.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateProduct.isPending}
                  className="bg-primary hover:bg-primary/90"
                >
                  {updateProduct.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelEditing}
                >
                  <X className="size-3" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-medium text-foreground">{stripHtml(product.name)}</h4>
                  {product.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {stripHtml(product.description)}
                    </p>
                  )}
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={onStartEditing}
                >
                  <Pencil className="size-3" />
                </Button>
              </div>
              {product.price != null && (
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(product.price, product.currency)}
                </p>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
