'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Loader2,
  LinkIcon,
  Upload,
  AlertCircle,
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
import { useProfile, PRODUCT_SLOT_LIMITS } from '@/hooks/use-profile';
import { ProductCard } from '@/components/products/ProductCard';
import { ScrapeResults } from '@/components/products/ScrapeResults';
import { ManualUploadForm } from '@/components/products/ManualUploadForm';
import { isExternalUrl, getSignedImageUrls } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import type { Product, BrandSummary } from '@/types/database';

/** Batch resolve first image for all products (1 API call instead of N) */
function useResolvedProductImages(products: Product[] | undefined) {
  const [imageMap, setImageMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!products || products.length === 0) return;

    let cancelled = false;
    const external: [string, string][] = [];
    const internal: [string, string][] = [];

    for (const p of products) {
      const firstImage = p.images?.[0];
      if (!firstImage) continue;
      if (isExternalUrl(firstImage)) external.push([p.id, firstImage]);
      else internal.push([p.id, firstImage]);
    }

    const paths = internal.map(([, path]) => path);
    getSignedImageUrls('product-images', paths).then((urls) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      external.forEach(([id, url]) => { map[id] = url; });
      internal.forEach(([id], i) => { map[id] = urls[i]; });
      setImageMap(map);
    });

    return () => { cancelled = true; };
  }, [products]);

  return imageMap;
}

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
  const { data: profile } = useProfile();
  const scrapeProduct = useScrapeProduct();
  const queryClient = useQueryClient();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);

  const productImageMap = useResolvedProductImages(products);
  const hasProducts = (products?.length ?? 0) > 0;
  const plan = profile?.plan ?? 'free';
  const isAdmin = profile?.role === 'admin';
  const productLimit = PRODUCT_SLOT_LIMITS[plan];
  const productCount = products?.length ?? 0;
  const atProductLimit = !isAdmin && productCount >= productLimit;
  const approachingLimit = !isAdmin && productCount >= productLimit * 0.8;

  async function handleScrape() {
    if (!importUrl.trim()) return;

    setScrapeError(null);
    try {
      const result = await scrapeProduct.mutateAsync({ url: importUrl.trim() });
      if (result.products.length === 0) {
        if (result.blocked_by_robots) {
          throw new Error('This store blocks automated scraping (robots.txt). Try manual upload.');
        }
        throw new Error('No products could be extracted from this URL. Try a direct product page.');
      }
      if (result.save_failed) {
        const detail = result.save_error ? ` (${result.save_error})` : '';
        throw new Error(
          `We scraped this page but could not save products to your account. Please try again.${detail}`
        );
      }
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
      if (scraped.length === 0) {
        throw new Error('Products were found but none were saved to your account. Please try again.');
      }
      setScrapedProducts(scraped);
      setScrapedBrandSummary(result.brand_summary ?? null);
      setShowScrapeResults(true);
      setImportUrl('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to scrape product';
      setScrapeError(message);
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
    setScrapeError(null);
    toast.success('Products imported successfully!');
  }

  function handleUploadSuccess() {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    setShowImportDialog(false);
  }

  function handleDialogClose(open: boolean) {
    if (!open) {
      setShowImportDialog(false);
      setShowScrapeResults(false);
      setScrapedProducts([]);
      setScrapedBrandSummary(null);
      setImportUrl('');
      setScrapeError(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <span className="mt-1 block text-sm text-muted-foreground" suppressHydrationWarning>
            {isLoading ? (
              <Skeleton className="inline-block h-4 w-32" />
            ) : (
              `${products?.length ?? 0} product${(products?.length ?? 0) !== 1 ? 's' : ''}`
            )}
          </span>
        </div>
        {hasProducts && (
          <div className="flex items-center gap-3">
            {atProductLimit && (
              <Badge variant="outline" className={`text-xs ${approachingLimit ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'text-muted-foreground'}`}>
                {atProductLimit && <AlertCircle className="size-3" />}
                {productCount}/{productLimit} products
              </Badge>
            )}
            <Button
              variant="secondary"
              disabled={atProductLimit}
              onClick={() => {
                if (atProductLimit) {
                  toast.error(`You've reached the ${productLimit} product limit for your ${plan} plan. Upgrade to add more.`);
                  return;
                }
                setShowImportDialog(true);
              }}
            >
              <LinkIcon className="size-4" />
              Import Product
            </Button>
            <Button
              disabled={atProductLimit}
              onClick={() => {
                if (atProductLimit) {
                  toast.error(`You've reached the ${productLimit} product limit for your ${plan} plan. Upgrade to add more.`);
                  return;
                }
                setShowImportDialog(true);
              }}
            >
              <Plus className="size-4" />
              Add Manually
            </Button>
          </div>
        )}
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
              resolvedImageUrl={productImageMap[product.id]}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && !hasProducts && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Package className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No products yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Import products from your store or upload them manually to get
                started with video generation.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowImportDialog(true)}>
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
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Import a product from a URL or upload one manually.
            </DialogDescription>
          </DialogHeader>

          {showScrapeResults && scrapedProducts.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <ScrapeResults
                products={scrapedProducts}
                brandSummary={scrapedBrandSummary}
                onConfirmed={handleScrapeConfirmed}
              />
            </div>
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
                    {scrapeError && (
                      <p className="text-xs text-destructive">{scrapeError}</p>
                    )}
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

function DeleteProductWrapper({ product, resolvedImageUrl }: { product: Product; resolvedImageUrl?: string }) {
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

  return <ProductCard product={product} onDelete={handleDelete} resolvedImageUrl={resolvedImageUrl} />;
}
