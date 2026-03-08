'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Package,
  Loader2,
  LinkIcon,
  Upload,
  ArrowLeft,
  Store,
  Pencil,
  Trash2,
  Lock,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useProducts,
  useProductsByBrand,
  useScrapeProduct,
  useConfirmProduct,
  useDeleteProduct,
} from '@/hooks/use-products';
import {
  useBrands,
  useCreateBrand,
  useUpdateBrand,
  useDeleteBrand,
  type Brand,
} from '@/hooks/use-brands';
import { useProfile, BRAND_LIMITS, PRODUCTS_PER_BRAND_LIMITS } from '@/hooks/use-profile';
import { ProductCard } from '@/components/products/ProductCard';
import { ManualUploadForm } from '@/components/products/ManualUploadForm';
import { ScrapeResults } from '@/components/products/ScrapeResults';
import Link from 'next/link';
import { isExternalUrl, getSignedImageUrls } from '@/lib/storage';
import type { Product, BrandSummary } from '@/types/database';

/* -------------------------------------------------------------------------- */
/*  Image resolution hook                                                     */
/* -------------------------------------------------------------------------- */

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
/*  Scrape candidate card                                                     */
/* -------------------------------------------------------------------------- */

function ScrapeCandidate({
  product,
  selected,
  onToggle,
}: {
  product: Product;
  selected: boolean;
  onToggle: () => void;
}) {
  const img = product.images?.[0];
  return (
    <div
      className={`relative flex cursor-pointer flex-col gap-2 rounded-lg border p-3 transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
      onClick={onToggle}
    >
      <Checkbox
        checked={selected}
        className="absolute right-3 top-3"
        onCheckedChange={onToggle}
      />
      {img && (
        <div className="aspect-video overflow-hidden rounded-md bg-muted">
          <img src={img} alt={product.name} className="size-full object-cover" loading="lazy" />
        </div>
      )}
      <p className="pr-6 text-sm font-medium line-clamp-2">{product.name}</p>
      {product.price != null && (
        <p className="text-xs text-muted-foreground">
          {product.currency} {product.price}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeletons                                                                 */
/* -------------------------------------------------------------------------- */

function BrandCardSkeleton() {
  return (
    <Card className="h-full">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="grid grid-cols-3 gap-1">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="aspect-square rounded" />)}
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Brand card                                                                */
/* -------------------------------------------------------------------------- */

function BrandCard({
  brand,
  productCount,
  onClick,
}: {
  brand: Brand;
  productCount: number;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="group w-full text-left">
      <Card className="h-full transition-colors hover:border-primary/30">
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground capitalize">{brand.name}</p>
              <p className="text-xs text-muted-foreground">
                {productCount} product{productCount !== 1 ? 's' : ''}
              </p>
            </div>
            {brand.store_url && (
              <Badge variant="outline" className="text-xs shrink-0">
                {new URL(brand.store_url.startsWith('http') ? brand.store_url : `https://${brand.store_url}`).hostname.replace(/^www\./, '')}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main page                                                                 */
/* -------------------------------------------------------------------------- */

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const { data: brands, isLoading: brandsLoading, error: brandsError } = useBrands();
  const { data: profile } = useProfile();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();
  const scrapeProduct = useScrapeProduct();
  const confirmProduct = useConfirmProduct();
  const queryClient = useQueryClient();

  const plan = profile?.plan ?? 'free';
  const isAdmin = profile?.role === 'admin';
  const brandLimit = BRAND_LIMITS[plan] ?? 1;
  const brandCount = brands?.length ?? 0;
  const atBrandLimit = !isAdmin && brandLimit !== Infinity && brandCount >= brandLimit;

  // Navigation state
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const selectedBrand = useMemo(
    () => brands?.find((b) => b.id === selectedBrandId) ?? null,
    [brands, selectedBrandId],
  );

  // Brand products
  const { data: brandProducts, isLoading: productsLoading } = useProductsByBrand(selectedBrandId);
  const productImageMap = useResolvedProductImages(brandProducts);

  // New Brand dialog
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandUrl, setNewBrandUrl] = useState('');

  // Edit Brand inline
  const [editingBrand, setEditingBrand] = useState(false);
  const [editName, setEditName] = useState('');

  // Import dialog
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showCandidates, setShowCandidates] = useState(false);
  const [scrapedPlatform, setScrapedPlatform] = useState<string | null>(null);
  const [scrapedBrandSummary, setScrapedBrandSummary] = useState<BrandSummary | null>(null);
  const candidatesScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

  // If selected brand disappears (deleted), go back
  useEffect(() => {
    if (selectedBrandId && !selectedBrand && !brandsLoading) {
      setSelectedBrandId(null);
    }
  }, [selectedBrandId, selectedBrand, brandsLoading]);

  // Track scroll position in candidates list to show/hide down arrow
  useEffect(() => {
    const el = candidatesScrollRef.current;
    if (!el) return;
    const check = () => setShowScrollArrow(el.scrollHeight - el.scrollTop - el.clientHeight > 40);
    check();
    el.addEventListener('scroll', check, { passive: true });
    return () => el.removeEventListener('scroll', check);
  }, [showCandidates, scrapedProducts]);

  // Pre-fill import URL from query param (e.g. coming from landing CTA post-signup)
  useEffect(() => {
    const urlParam = searchParams.get('importUrl');
    if (!urlParam || brandsLoading) return;
    setImportUrl(urlParam);
    setShowImport(true);
    // If there's at least one brand, select it so the import can proceed directly
    if (brands && brands.length > 0 && !selectedBrandId) {
      setSelectedBrandId(brands[0].id);
    }
  }, [searchParams, brandsLoading, brands]);

  async function handleCreateBrand() {
    if (!newBrandName.trim()) return;
    try {
      await createBrand.mutateAsync({ name: newBrandName.trim(), store_url: newBrandUrl.trim() || undefined });
      setShowNewBrand(false);
      setNewBrandName('');
      setNewBrandUrl('');
      toast.success('Brand created!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create brand';
      toast.error(msg);
    }
  }

  async function handleUpdateBrand() {
    if (!selectedBrand || !editName.trim()) return;
    try {
      await updateBrand.mutateAsync({ brand_id: selectedBrand.id, name: editName.trim() });
      setEditingBrand(false);
      toast.success('Brand updated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update brand';
      toast.error(msg);
    }
  }

  async function handleDeleteBrand() {
    if (!selectedBrand) return;
    try {
      await deleteBrand.mutateAsync(selectedBrand.id);
      setSelectedBrandId(null);
      toast.success('Brand deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete brand';
      toast.error(msg);
    }
  }

  async function handleScrape() {
    if (!importUrl.trim()) return;
    setScrapeError(null);
    setScrapedProducts([]);
    setSelectedProductIds(new Set());
    try {
      const result = await scrapeProduct.mutateAsync({ url: importUrl.trim() });
      if (!result || result.products.length === 0) {
        throw new Error(result?.blocked_by_robots ? 'This store blocks automated scraping. Try manual upload.' : 'No products found at this URL.');
      }
      // Products from scrape have real DB IDs (saved unconfirmed)
      const candidates: Product[] = result.products
        .filter((p) => p.id != null)
        .map((p) => ({
          id: p.id!,
          owner_id: '',
          store_url: importUrl.trim(),
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
      if (candidates.length === 0) {
        throw new Error('Products were found but could not be saved. Please try again.');
      }
      setScrapedProducts(candidates);
      setSelectedProductIds(new Set(candidates.map((p) => p.id)));
      setScrapedPlatform(result.platform ?? result.source ?? null);
      setScrapedBrandSummary(result.brand_summary as BrandSummary | null ?? null);
      setShowCandidates(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to scrape URL';
      setScrapeError(msg);
      toast.error(msg);
    }
  }

  async function handleConfirmProducts() {
    if (!selectedBrand) return;
    const selectedIds = [...selectedProductIds];
    if (selectedIds.length === 0) return;

    try {
      await confirmProduct.mutateAsync({
        product_ids: selectedIds,
        brand_id: selectedBrand.id,
      });
      toast.success(`${selectedIds.length} product${selectedIds.length !== 1 ? 's' : ''} imported!`);
      setShowImport(false);
      setShowCandidates(false);
      setScrapedProducts([]);
      setSelectedProductIds(new Set());
      setImportUrl('');
      setScrapeError(null);
      queryClient.invalidateQueries({ queryKey: ['products', 'brand', selectedBrandId] });
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm products';
      toast.error(msg);
    }
  }

  function handleImportClose(open: boolean) {
    if (!open) {
      setShowImport(false);
      setShowCandidates(false);
      setScrapedProducts([]);
      setImportUrl('');
      setScrapeError(null);
      setScrapedPlatform(null);
      setScrapedBrandSummary(null);
    }
  }

  function handleConfirmCompleted() {
    setShowImport(false);
    setShowCandidates(false);
    setScrapedProducts([]);
    setSelectedProductIds(new Set());
    setImportUrl('');
    setScrapeError(null);
    setScrapedPlatform(null);
    setScrapedBrandSummary(null);
    queryClient.invalidateQueries({ queryKey: ['products', 'brand', selectedBrandId] });
    queryClient.invalidateQueries({ queryKey: ['brands'] });
  }

  const showBrandList = selectedBrandId === null;

  // Import dialog - product slot helpers
  const slotsLeft = PRODUCTS_PER_BRAND_LIMITS[plan] === Infinity
    ? Infinity
    : Math.max(0, PRODUCTS_PER_BRAND_LIMITS[plan] - (brandProducts?.length ?? 0));
  const isAtLimit = !isAdmin && slotsLeft === 0;
  const isOverSelection = !isAdmin && PRODUCTS_PER_BRAND_LIMITS[plan] !== Infinity
    && selectedProductIds.size > slotsLeft;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!showBrandList && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedBrandId(null)}>
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {showBrandList ? 'Brands' : (editingBrand ? 'Edit Brand' : selectedBrand?.name ?? 'Products')}
            </h1>
            <span className="mt-1 block text-sm text-muted-foreground" suppressHydrationWarning>
              {brandsLoading ? (
                <Skeleton className="inline-block h-4 w-32" />
              ) : showBrandList ? (
                `${brandCount} brand${brandCount !== 1 ? 's' : ''}${!isAdmin && brandLimit !== Infinity ? ` · ${brandLimit - brandCount} slot${brandLimit - brandCount !== 1 ? 's' : ''} left` : ''}`
              ) : (
                `${brandProducts?.length ?? 0} product${(brandProducts?.length ?? 0) !== 1 ? 's' : ''}`
              )}
            </span>
          </div>
        </div>

        {showBrandList ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => {
                      if (atBrandLimit) return;
                      setShowNewBrand(true);
                    }}
                    disabled={atBrandLimit}
                  >
                    {atBrandLimit ? <Lock className="size-4" /> : <Plus className="size-4" />}
                    New Brand
                  </Button>
                </span>
              </TooltipTrigger>
              {atBrandLimit && (
                <TooltipContent>
                  Brand limit reached for your {plan} plan. Upgrade to add more.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        ) : selectedBrand && (
          <div className="flex items-center gap-2">
            {!editingBrand && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setEditingBrand(true); setEditName(selectedBrand.name); }}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
            <Button onClick={() => setShowImport(true)}>
              <Plus className="size-4" />
              Import Products
            </Button>
          </div>
        )}
      </div>

      {/* Inline brand edit form */}
      {!showBrandList && editingBrand && (
        <div className="flex items-center gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Brand name"
            className="max-w-xs"
          />
          <Button size="sm" onClick={handleUpdateBrand} disabled={updateBrand.isPending}>
            {updateBrand.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditingBrand(false)}>Cancel</Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDeleteBrand}
            disabled={deleteBrand.isPending}
          >
            <Trash2 className="size-4" />
            Delete Brand
          </Button>
        </div>
      )}

      {/* Loading */}
      {(brandsLoading || (selectedBrandId && productsLoading)) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <BrandCardSkeleton key={i} />)}
        </div>
      )}

      {/* Brand list */}
      {!brandsLoading && showBrandList && (brands?.length ?? 0) > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands!.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              productCount={brand.product_count ?? 0}
              onClick={() => setSelectedBrandId(brand.id)}
            />
          ))}
        </div>
      )}

      {/* Products list (brand detail) */}
      {!showBrandList && !productsLoading && (brandProducts?.length ?? 0) > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brandProducts!.map((product) => (
            <DeleteProductWrapper
              key={product.id}
              product={product}
              resolvedImageUrl={productImageMap[product.id]}
            />
          ))}
        </div>
      )}

      {/* Empty brand products */}
      {!showBrandList && !productsLoading && (brandProducts?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Package className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No products yet. Import from URL or upload manually.</p>
            <Button onClick={() => setShowImport(true)}>
              <Plus className="size-4" /> Import Products
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty brand list */}
      {!brandsLoading && showBrandList && (brands?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Store className="size-7 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">No brands yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Create a brand to start importing products and generating UGC ads.
              </p>
            </div>
            <Button onClick={() => setShowNewBrand(true)}>
              <Plus className="size-4" /> Add Brand
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Brand Dialog */}
      <Dialog open={showNewBrand} onOpenChange={(open) => { if (!open) { setShowNewBrand(false); setNewBrandName(''); setNewBrandUrl(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Brand</DialogTitle>
            <DialogDescription>Add a brand to group your products.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-name">Brand Name</Label>
              <Input
                id="brand-name"
                placeholder="My Store"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateBrand(); }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-url">Store URL (optional)</Label>
              <Input
                id="brand-url"
                placeholder="https://mystore.com"
                value={newBrandUrl}
                onChange={(e) => setNewBrandUrl(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewBrand(false)}>Cancel</Button>
              <Button onClick={handleCreateBrand} disabled={!newBrandName.trim() || createBrand.isPending}>
                {createBrand.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Create Brand'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={handleImportClose}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle>Import Products</DialogTitle>
            <DialogDescription>
              {selectedBrand ? `Adding products to "${selectedBrand.name}"` : 'Import products'}
            </DialogDescription>
          </DialogHeader>

          {showCandidates && scrapedProducts.length > 0 && scrapedPlatform === 'saas' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              <ScrapeResults
                products={scrapedProducts}
                brandSummary={scrapedBrandSummary}
                brandId={selectedBrandId ?? undefined}
                onConfirmed={handleConfirmCompleted}
              />
            </div>
          ) : showCandidates && scrapedProducts.length > 0 ? (
            <div className="relative flex min-h-0 flex-1 flex-col">
            <div ref={candidatesScrollRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
              <div className={`text-sm ${isOverSelection || isAtLimit ? 'text-red-400' : 'text-muted-foreground'}`}>
                {selectedProductIds.size} selected
                {!isAdmin && PRODUCTS_PER_BRAND_LIMITS[plan] !== Infinity && (
                  <> &middot; {slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} left{isOverSelection ? ' (too many selected)' : ''}</>
                )}
              </div>
              {isAtLimit && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                  <p className="text-sm">
                    <span className="font-medium text-red-400">Product limit reached</span>
                    <span className="text-muted-foreground">. Upgrade to add more.</span>
                    <Link href="/settings/billing" className="ml-1 text-xs text-primary underline-offset-2 hover:underline">
                      Upgrade →
                    </Link>
                  </p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {scrapedProducts.map((p) => (
                  <ScrapeCandidate
                    key={p.id}
                    product={p}
                    selected={selectedProductIds.has(p.id)}
                    onToggle={() => {
                      setSelectedProductIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      });
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2 shrink-0">
                <Button variant="outline" onClick={() => { setShowCandidates(false); setScrapeError(null); }}>Back</Button>
                <Button
                  onClick={handleConfirmProducts}
                  disabled={selectedProductIds.size === 0 || confirmProduct.isPending || isOverSelection}
                >
                  {confirmProduct.isPending ? <Loader2 className="size-4 animate-spin" /> : `Confirm ${selectedProductIds.size} Product${selectedProductIds.size !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </div>
            {showScrollArrow && (
              <button
                onClick={() => candidatesScrollRef.current?.scrollTo({ top: candidatesScrollRef.current.scrollHeight, behavior: 'smooth' })}
                className="absolute bottom-14 right-3 z-10 flex size-7 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted transition-colors"
                aria-label="Scroll to bottom"
              >
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            )}
            </div>
          ) : (
            <Tabs defaultValue="import-url" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="import-url" className="flex-1">
                  <LinkIcon className="size-3.5" /> Import from URL
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1">
                  <Upload className="size-3.5" /> Upload Manually
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
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScrape(); } }}
                      />
                    </div>
                    {scrapeError && <p className="text-xs text-destructive">{scrapeError}</p>}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => handleImportClose(false)}>Cancel</Button>
                    <Button onClick={handleScrape} disabled={!importUrl.trim() || scrapeProduct.isPending}>
                      {scrapeProduct.isPending ? (
                        <><Loader2 className="size-4 animate-spin" /> Scanning...</>
                      ) : 'Scan for Products'}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="upload">
                <div className="pt-2">
                  <ManualUploadForm onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['products', 'brand', selectedBrandId] });
                    queryClient.invalidateQueries({ queryKey: ['brands'] });
                    setShowImport(false);
                  }} />
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
/*  Delete wrapper                                                            */
/* -------------------------------------------------------------------------- */

function DeleteProductWrapper({ product, resolvedImageUrl }: { product: Product; resolvedImageUrl?: string }) {
  const deleteProduct = useDeleteProduct(product.id);
  async function handleDelete() {
    try {
      await deleteProduct.mutateAsync();
      toast.success(`"${product.name}" deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete product');
    }
  }
  return <ProductCard product={product} onDelete={handleDelete} resolvedImageUrl={resolvedImageUrl} />;
}
