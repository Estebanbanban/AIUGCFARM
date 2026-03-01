"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { Plus, Package, ImageIcon, Loader2, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const mockProducts = [
  {
    id: "prod-1",
    name: "Vitamin C Serum",
    price: 29.99,
    currency: "USD",
    images: [] as string[],
    source: "shopify" as const,
    confirmed: true,
  },
  {
    id: "prod-2",
    name: "Hyaluronic Acid Moisturizer",
    price: 34.99,
    currency: "USD",
    images: [] as string[],
    source: "generic" as const,
    confirmed: true,
  },
];

export default function ProductsPage() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  const hasProducts = mockProducts.length > 0;

  function handleImport() {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    // Would call useScrapeProduct mutation
    setTimeout(() => {
      setIsImporting(false);
      setShowImportDialog(false);
      setImportUrl("");
    }, 2000);
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
            Import and manage your products for video generation.
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

      {/* Product Grid */}
      {hasProducts ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockProducts.map((product) => (
            <Card
              key={product.id}
              className="h-full transition-colors hover:border-violet-500/30"
            >
              <CardContent className="flex flex-col gap-3">
                <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
                  {product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="size-full rounded-lg object-cover"
                    />
                  ) : (
                    <ImageIcon className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    ${product.price.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {product.source}
                  </Badge>
                  {product.confirmed && (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-500/10 text-xs text-emerald-400"
                    >
                      Confirmed
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-violet-500/10">
              <Package className="size-7 text-violet-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">
                Import your first product
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Paste a product URL to automatically scrape details, or add a
                product manually.
              </p>
            </div>
            <Button
              className="bg-violet-600 hover:bg-violet-700"
              onClick={() => setShowImportDialog(true)}
            >
              <Plus className="size-4" />
              Import Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Product</DialogTitle>
            <DialogDescription>
              Paste a product URL and we will automatically extract product
              details.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
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
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importUrl.trim() || isImporting}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isImporting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
