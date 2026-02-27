'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import {
  Plus,
  Package,
  Loader2,
  LinkIcon,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useProducts, useScrapeProduct, useDeleteProduct } from '@/hooks/use-products';
import { ProductCard } from '@/components/products/ProductCard';
import { ScrapeResults } from '@/components/products/ScrapeResults';
import { ManualUploadForm } from '@/components/products/ManualUploadForm';
import type { Product, BrandSummary } from '@/types/database';

function ProductCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProductsPage() {
  const { data: products, isLoading, error } = useProducts();
  const scrapeProduct = useScrapeProduct();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);

  const hasProducts = (products?.length ?? 0) > 0;

  async function handleScrape() {
    if (!importUrl.trim()) return;

    try {
      const result = await scrapeProduct.mutateAsync({ url: importUrl.trim() });
      // Map scraped products to Product shape for ScrapeResults
      const scraped: Product[] = result.products
        .filter((p) => p.id != null)
        .map((p) => ({
          id: p.id!,
          owner_id: '',
          store_url: null,
          name: p.name,
          description: p.description,
          price: p.price,
          currency: p.currency,
          images: p.images,
          brand_summary: p.brand_summary as BrandSummary | null,
          category: p.category,
          source: p.source as Product['source'],
          confirmed: false,
          created_at: '',
          updated_at: '',
        }));
      setScrapedProducts(scraped);
      setScrapedBrandSummary(result.brand_summary ?? null);
      setShowScrapeResults(true);
      setImportUrl('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to scrape product';
      toast.error(message, {
        action: {
          label: 'Retry',
          onClick: () => handleScrape(),
        },
      });
    }
  }

  function handleScrapeConfirmed() {
    setShowScrapeResults(false);
    setScrapedProducts([]);
    setScrapedBrandSummary(null);
    setShowImportDialog(false);
    toast.success('Products imported successfully!');
  }

  function handleUploadSuccess() {
    setShowImportDialog(false);
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      setShowImportDialog(false);
      setShowScrapeResults(false);
      setScrapedProducts([]);
      setScrapedBrandSummary(null);
      setImportUrl('');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              `${products?.length ?? 0} product${(products?.length ?? 0) !== 1 ? 's' : ''}`
            )}
          </p>
        </div>
        <Button
          className="bg-violet-600 hover:bg-violet-700"
          onClick={() => setShowImportDialog(true)}
        >
          <Plus className="size-4" />
          Import Product
        </Button>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-destructive">
              Failed to load products: {error.message}
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Product Grid */}
      {!isLoading && !error && hasProducts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products!.map((product) => (
            <DeleteProductWrapper
              key={product.id}
              product={product}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !hasProducts && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-violet-500/10">
              <Package className="size-7 text-violet-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">
                No products yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Import products from your store or upload them manually to get
                started with video generation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                onClick={() => setShowImportDialog(true)}
              >
                <LinkIcon className="size-4" />
                Import from Store
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowImportDialog(true)}
              >
                <Upload className="size-4" />
                Upload Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Dialog with Tabs */}
      <Dialog open={showImportDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Import a product from a URL or upload one manually.
            </DialogDescription>
          </DialogHeader>

          {showScrapeResults && scrapedProducts.length > 0 ? (
            <ScrapeResults
              products={scrapedProducts}
              brandSummary={scrapedBrandSummary}
              onConfirmed={handleScrapeConfirmed}
            />
          ) : (
            <Tabs defaultValue="import-url" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="import-url" className="flex-1">
                  <LinkIcon className="size-3.5" />
                  Import from URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1">
                  <Upload className="size-3.5" />
                  Upload Manually
                </TabsTrigger>
              </TabsList>

              {/* Import from URL Tab */}
              <TabsContent value="import-url">
                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="product-url">Product URL</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="product-url"
                        placeholder="https://store.com/products/..."
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        className="pl-10"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleScrape();
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supports Shopify stores and most e-commerce product pages.
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleScrape}
                      disabled={!importUrl.trim() || scrapeProduct.isPending}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {scrapeProduct.isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        'Import'
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Upload Manually Tab */}
              <TabsContent value="upload">
                <div className="pt-2">
                  <ManualUploadForm onSuccess={handleUploadSuccess} />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Wrapper component that manages the delete mutation per product.
 * Needed because useDeleteProduct requires a product ID at hook call time.
 */
function DeleteProductWrapper({ product }: { product: Product }) {
  const deleteProduct = useDeleteProduct(product.id);

  async function handleDelete(id: string) {
    try {
      await deleteProduct.mutateAsync();
      toast.success(`"${product.name}" deleted`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete product';
      toast.error(message);
    }
  }

  return <ProductCard product={product} onDelete={handleDelete} />;
}
