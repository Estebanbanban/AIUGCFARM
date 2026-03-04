'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Loader2,
  LinkIcon,
  Upload,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Store,
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

/* -------------------------------------------------------------------------- */
/*  Brand grouping helpers                                                     */
/* -------------------------------------------------------------------------- */

function getBrandKey(storeUrl: string | null): string {
  if (!storeUrl) return '_manual';
  try {
    return new URL(storeUrl).hostname.toLowerCase();
  } catch {
    return storeUrl.slice(0, 80).toLowerCase();
  }
}

function getBrandName(storeUrl: string | null): string {
  if (!storeUrl) return 'My Products';
  try {
    return new URL(storeUrl).hostname
      .replace(/^www\./, '')
      .replace(/\.myshopify\.com$/, '');
  } catch {
    return storeUrl;
  }
}

interface BrandGroup {
  key: string;
  name: string;
  storeUrl: string | null;
  products: Product[];
  source: Product['source'] | null;
}

function groupByBrand(products: Product[]): BrandGroup[] {
  const map = new Map<string, BrandGroup>();
  for (const p of products) {
    const key = getBrandKey(p.store_url);
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: getBrandName(p.store_url),
        storeUrl: p.store_url,
        products: [],
        source: p.source,
      });
    }
    map.get(key)!.products.push(p);
  }
  return Array.from(map.values());
}

/* -------------------------------------------------------------------------- */
/*  Image resolution hook                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Brand card                                                                 */
/* -------------------------------------------------------------------------- */

function BrandCard({
  brand,
  imageMap,
  onClick,
}: {
  brand: BrandGroup;
  imageMap: Record<string, string>;
  onClick: () => void;
}) {
  const previews = brand.products.slice(0, 3);
  const tone = brand.products[0]?.brand_summary?.tone ?? null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left"
    >
      <Card className="h-full transition-colors hover:border-primary/30 group-hover:border-primary/30">
        <CardContent className="flex flex-col gap-3 p-4">
          {/* Product image preview strip */}
          <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-lg">
            {previews.map((p) => (
              <div key={p.id} className="aspect-square bg-muted">
                {imageMap[p.id] && (
                  <img
                    src={imageMap[p.id]}
                    alt={p.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
            ))}
            {Array.from({ length: Math.max(0, 3 - previews.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square bg-muted rounded" />
            ))}
          </div>

          {/* Brand info */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground capitalize">{brand.name}</p>
              <p className="text-xs text-muted-foreground">
                {brand.products.length} product{brand.products.length !== 1 ? 's' : ''}
              </p>
              {tone && (
                <p className="mt-1 truncate text-xs text-muted-foreground italic">{tone}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {brand.source && brand.source !== '_manual' as string && (
                <Badge variant="outline" className="text-xs capitalize">
                  {brand.source}
                </Badge>
              )}
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton                                                                   */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Main page                                                                  */
/* -------------------------------------------------------------------------- */

export default function ProductsPage() {
  const { data: products, isLoading, error } = useProducts();
  const { data: profile } = useProfile();
  const scrapeProduct = useScrapeProduct();
  const queryClient = useQueryClient();

  // Brand navigation state (null = brand list, string = selected brand key)
  const [selectedBrandKey, setSelectedBrandKey] = useState<string | null>(null);

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
  const [showScrapeResults, setShowScrapeResults] = useState(false);

  const productImageMap = useResolvedProductImages(products);

  const plan = profile?.plan ?? 'free';
  const isAdmin = profile?.role === 'admin';
  const productLimit = PRODUCT_SLOT_LIMITS[plan];
  const productCount = products?.length ?? 0;
  const atProductLimit = !isAdmin && productCount >= productLimit;
  const approachingLimit = !isAdmin && productCount >= productLimit * 0.8;

  // Group all products by brand/store
  const brands = useMemo(() => groupByBrand(products ?? []), [products]);

  // Currently viewed brand
  const selectedBrand = useMemo(
    () => brands.find((b) => b.key === selectedBrandKey) ?? null,
    [brands, selectedBrandKey],
  );

  // If the selected brand no longer exists (e.g. all products deleted), go back
  useEffect(() => {
    if (selectedBrandKey && !selectedBrand && !isLoading) {
      setSelectedBrandKey(null);
    }
  }, [selectedBrandKey, selectedBrand, isLoading]);

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

  /* ---------------------------------------------------------------------- */
  /*  Render: brand list view                                                 */
  /* ---------------------------------------------------------------------- */

  const showBrandList = selectedBrandKey === null;

  return (
    <div className="flex flex-col gap-6">
      {/* ------------------------------------------------------------------ */}
      {/*  Header                                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Back button when inside a brand */}
          {!showBrandList && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedBrandKey(null)}
            >
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {showBrandList ? 'Brands' : selectedBrand?.name ?? 'Products'}
            </h1>
            <span className="mt-1 block text-sm text-muted-foreground" suppressHydrationWarning>
              {isLoading ? (
                <Skeleton className="inline-block h-4 w-32" />
              ) : showBrandList ? (
                `${brands.length} brand${brands.length !== 1 ? 's' : ''}`
              ) : (
                `${selectedBrand?.products.length ?? 0} product${(selectedBrand?.products.length ?? 0) !== 1 ? 's' : ''}`
              )}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {(showBrandList ? brands.length > 0 : selectedBrand !== null) && (
          <div className="flex items-center gap-3">
            {atProductLimit && (
              <Badge
                variant="outline"
                className={`text-xs ${approachingLimit ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'text-muted-foreground'}`}
              >
                {atProductLimit && <AlertCircle className="size-3" />}
                {productCount}/{productLimit} products
              </Badge>
            )}
            <Button
              onClick={() => {
                if (atProductLimit) {
                  toast.error(`You've reached the ${productLimit} product limit for your ${plan} plan. Upgrade to add more.`);
                  return;
                }
                setShowImportDialog(true);
              }}
              disabled={atProductLimit}
            >
              <Plus className="size-4" />
              {showBrandList ? 'Add Brand' : 'Add Product'}
            </Button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Error state                                                        */}
      {/* ------------------------------------------------------------------ */}
      {error && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <p className="text-sm text-destructive">
              Failed to load products: {error.message}
            </p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Loading skeletons                                                  */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Brand list view                                                    */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && !error && showBrandList && brands.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard
              key={brand.key}
              brand={brand}
              imageMap={productImageMap}
              onClick={() => setSelectedBrandKey(brand.key)}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Product list view (inside a brand)                                */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && !error && !showBrandList && selectedBrand && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {selectedBrand.products.map((product) => (
            <DeleteProductWrapper
              key={product.id}
              product={product}
              resolvedImageUrl={productImageMap[product.id]}
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Empty state (no products at all)                                  */}
      {/* ------------------------------------------------------------------ */}
      {!isLoading && !error && brands.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Store className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No brands yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Import your store to get started. We&apos;ll automatically group
                your products by brand.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setShowImportDialog(true)}>
                <LinkIcon className="size-4" />
                Import from Store
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                <Upload className="size-4" />
                Upload Manually
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Import Dialog                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Dialog open={showImportDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {showBrandList ? 'Add Brand' : 'Add Product'}
            </DialogTitle>
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

              <TabsContent value="import-url">
                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="product-url">Store or Product URL</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="product-url"
                        placeholder="https://yourstore.com/products/..."
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
                    <Button variant="outline" onClick={() => handleDialogClose(false)}>
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

/* -------------------------------------------------------------------------- */
/*  Delete wrapper (unchanged)                                                */
/* -------------------------------------------------------------------------- */

function DeleteProductWrapper({ product, resolvedImageUrl }: { product: Product; resolvedImageUrl?: string }) {
  const deleteProduct = useDeleteProduct(product.id);

  async function handleDelete() {
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
