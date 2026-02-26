"use client";

export const dynamic = "force-dynamic";

import Link from "next/link";
import { Plus, Store, ExternalLink, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const mockBrands = [
  {
    id: "brand-1",
    name: "GlowSkin Cosmetics",
    url: "https://glowskin.com",
    productCount: 8,
    createdAt: "Feb 10, 2026",
    tone: "Friendly & Empowering",
  },
  {
    id: "brand-2",
    name: "FitFuel Nutrition",
    url: "https://fitfuel.co",
    productCount: 5,
    createdAt: "Feb 15, 2026",
    tone: "Energetic & Motivational",
  },
];

export default function BrandsPage() {
  const hasBrands = mockBrands.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Brands
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your stores and product catalogs.
          </p>
        </div>
        <Button asChild className="bg-violet-600 hover:bg-violet-700">
          <Link href="/dashboard/brands/new">
            <Plus className="size-4" />
            Add Brand
          </Link>
        </Button>
      </div>

      {/* Brand Grid */}
      {hasBrands ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mockBrands.map((brand) => (
            <Link
              key={brand.id}
              href={`/dashboard/brands/${brand.id}`}
              className="group"
            >
              <Card className="h-full transition-colors hover:border-violet-500/30">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                      <Store className="size-5 text-violet-500" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      <Package className="size-3" />
                      {brand.productCount} products
                    </Badge>
                  </div>
                  <CardTitle className="mt-3 text-foreground">
                    {brand.name}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <ExternalLink className="size-3" />
                    {brand.url}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tone: {brand.tone}</span>
                    <span>{brand.createdAt}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex size-14 items-center justify-center rounded-full bg-violet-500/10">
              <Store className="size-7 text-violet-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-foreground">
                Import your first store
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add your brand and products to start generating UGC video ads.
              </p>
            </div>
            <Button asChild className="bg-violet-600 hover:bg-violet-700">
              <Link href="/dashboard/brands/new">
                <Plus className="size-4" />
                Add Brand
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
