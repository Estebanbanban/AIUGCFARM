"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ImageIcon,
  Pencil,
  Check,
  X,
  Sparkles,
  DollarSign,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

const mockProduct = {
  id: "prod-1",
  brand_id: "brand-1",
  name: "Vitamin C Serum",
  description:
    "A powerful antioxidant serum that brightens skin tone, reduces dark spots, and protects against environmental damage. Made with 20% L-Ascorbic Acid and Vitamin E for maximum efficacy.",
  price: 29.99,
  currency: "USD",
  primary_image_url: null as string | null,
  category: "Skincare",
  tags: ["vitamin c", "serum", "brightening", "anti-aging"],
};

export default function ProductDetailPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const productId = params.productId as string;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(mockProduct.name);
  const [editDescription, setEditDescription] = useState(
    mockProduct.description
  );
  const [editPrice, setEditPrice] = useState(String(mockProduct.price));

  function saveEdits() {
    // Would call useUpdateProduct mutation
    setIsEditing(false);
  }

  function cancelEdits() {
    setEditName(mockProduct.name);
    setEditDescription(mockProduct.description);
    setEditPrice(String(mockProduct.price));
    setIsEditing(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/dashboard/brands/${brandId}`}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mockProduct.name}
          </h1>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Product Image */}
        <Card>
          <CardContent>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
              {mockProduct.primary_image_url ? (
                <img
                  src={mockProduct.primary_image_url}
                  alt={mockProduct.name}
                  className="size-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="size-12" />
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Product Details */}
        <Card>
          <CardContent className="flex flex-col gap-5">
            {isEditing ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-name">Product Name</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-price">Price (USD)</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={saveEdits}
                    className="bg-violet-600 hover:bg-violet-700"
                  >
                    <Check className="size-4" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={cancelEdits}>
                    <X className="size-4" />
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    {mockProduct.name}
                  </h2>
                  <Badge variant="secondary" className="w-fit text-xs">
                    <Tag className="size-3" />
                    {mockProduct.category}
                  </Badge>
                </div>

                <Separator />

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Price
                  </span>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="size-4 text-emerald-400" />
                    <span className="text-lg font-bold text-foreground">
                      {formatCurrency(mockProduct.price, mockProduct.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase text-muted-foreground">
                    Description
                  </span>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {mockProduct.description}
                  </p>
                </div>

                {mockProduct.tags && mockProduct.tags.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Tags
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {mockProduct.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs capitalize"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <Button asChild className="w-fit bg-violet-600 hover:bg-violet-700">
                  <Link href={`/dashboard/generate?productId=${productId}`}>
                    <Sparkles className="size-4" />
                    Generate Video
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
