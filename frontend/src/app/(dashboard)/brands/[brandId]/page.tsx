"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Pencil,
  Check,
  X,
  Package,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

const mockBrand = {
  id: "brand-1",
  name: "GlowSkin Cosmetics",
  url: "https://glowskin.com",
  tone_of_voice: "Friendly & Empowering",
  target_demographic: "Women aged 25-40 interested in clean beauty",
  key_selling_points: [
    "100% natural ingredients",
    "Cruelty-free",
    "Free shipping over $50",
  ],
  ai_summary:
    "GlowSkin is a clean beauty brand focused on natural, cruelty-free skincare. Their target audience is health-conscious women who value transparency and sustainability in their beauty products.",
};

const mockProducts = [
  {
    id: "prod-1",
    name: "Vitamin C Serum",
    price: 29.99,
    currency: "USD",
    primary_image_url: null,
    category: "Skincare",
  },
  {
    id: "prod-2",
    name: "Hyaluronic Acid Moisturizer",
    price: 34.99,
    currency: "USD",
    primary_image_url: null,
    category: "Skincare",
  },
  {
    id: "prod-3",
    name: "Retinol Night Cream",
    price: 44.99,
    currency: "USD",
    primary_image_url: null,
    category: "Skincare",
  },
];

export default function BrandDetailPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(mockBrand.name);

  function saveName() {
    // Would call useUpdateBrand mutation
    setIsEditingName(false);
  }

  function cancelEditName() {
    setEditedName(mockBrand.name);
    setIsEditingName(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard/brands">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex flex-1 items-center gap-3">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-9 w-64 text-lg font-bold"
                autoFocus
              />
              <Button variant="ghost" size="icon-sm" onClick={saveName}>
                <Check className="size-4 text-emerald-400" />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={cancelEditName}>
                <X className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {mockBrand.name}
              </h1>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsEditingName(true)}
              >
                <Pencil className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Brand Info */}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Website
            </span>
            {mockBrand.url ? (
              <a
                href={mockBrand.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-violet-400 hover:underline"
              >
                {mockBrand.url}
                <ExternalLink className="size-3" />
              </a>
            ) : (
              <span className="text-sm text-muted-foreground">Not set</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Tone of Voice
            </span>
            <span className="text-sm text-foreground">
              {mockBrand.tone_of_voice || "Not set"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Target Demographic
            </span>
            <span className="text-sm text-foreground">
              {mockBrand.target_demographic || "Not set"}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase text-muted-foreground">
              Key Selling Points
            </span>
            <div className="flex flex-wrap gap-1.5">
              {mockBrand.key_selling_points?.map((point, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {point}
                </Badge>
              ))}
            </div>
          </div>

          {mockBrand.ai_summary && (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                AI Summary
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {mockBrand.ai_summary}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Products Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Products</h2>
          <Button variant="outline" size="sm">
            <Plus className="size-4" />
            Add Product
          </Button>
        </div>

        {mockProducts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockProducts.map((product) => (
              <Link
                key={product.id}
                href={`/dashboard/brands/${brandId}/products/${product.id}`}
                className="group"
              >
                <Card className="h-full transition-colors hover:border-violet-500/30">
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                      {product.primary_image_url ? (
                        <img
                          src={product.primary_image_url}
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
                      <div className="mt-1 flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {product.category}
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(product.price, product.currency)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10">
              <Package className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No products yet. Add your first product to get started.
              </p>
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                Add Product
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
