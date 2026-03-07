"use client";

import { useState, KeyboardEvent } from "react";
import { ChevronDown, ChevronUp, X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { BrandSummary } from "@/types/database";

interface BrandProfileCardProps {
  brandSummary: BrandSummary | null;
  onSave: (updated: BrandSummary) => void;
  productId: string;
}

const PRICE_POSITIONING_OPTIONS = [
  { value: "ultra-premium", label: "Ultra-Premium" },
  { value: "premium", label: "Premium" },
  { value: "mid-market", label: "Mid-Market" },
  { value: "affordable", label: "Affordable" },
  { value: "value", label: "Value" },
] as const;

function TagList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function addItem() {
    const trimmed = draft.trim();
    if (!trimmed || items.includes(trimmed)) return;
    onChange([...items, trimmed]);
    setDraft("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
          >
            {item}
            <button
              type="button"
              onClick={() => removeItem(i)}
              className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Remove ${item}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground">No items added yet.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={!draft.trim()}
          className="h-8 shrink-0 px-2"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function BrandProfileCard({
  brandSummary,
  onSave,
  productId: _productId,
}: BrandProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<BrandSummary | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // When expanding, initialise the draft from current brandSummary
  function handleToggle() {
    if (!expanded && brandSummary && draft === null) {
      setDraft({ ...brandSummary, selling_points: [...(brandSummary.selling_points ?? [])], customer_pain_points: [...(brandSummary.customer_pain_points ?? [])] });
    }
    setExpanded((prev) => !prev);
  }

  function handleCancel() {
    setDraft(brandSummary ? { ...brandSummary, selling_points: [...(brandSummary.selling_points ?? [])], customer_pain_points: [...(brandSummary.customer_pain_points ?? [])] } : null);
    setExpanded(false);
  }

  async function handleSave() {
    if (!draft) return;
    setIsSaving(true);
    try {
      await onSave(draft);
      setExpanded(false);
    } finally {
      setIsSaving(false);
    }
  }

  function patch(field: keyof BrandSummary, value: unknown) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  // Loading state
  if (brandSummary === null) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
        </CardHeader>
        <CardContent className="flex gap-2 pb-4">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">
            Brand Intelligence
          </CardTitle>
          <button
            type="button"
            onClick={handleToggle}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>Collapse <ChevronUp className="size-3.5" /></>
            ) : (
              <>Edit <ChevronDown className="size-3.5" /></>
            )}
          </button>
        </div>
      </CardHeader>

      {/* Collapsed: read-only badges */}
      {!expanded && (
        <CardContent className="flex flex-wrap gap-2 pb-4">
          {brandSummary.tone && (
            <Badge variant="secondary" className="text-xs font-normal">
              {brandSummary.tone}
            </Badge>
          )}
          {brandSummary.demographic && (
            <Badge variant="secondary" className="text-xs font-normal">
              {brandSummary.demographic}
            </Badge>
          )}
          {brandSummary.product_category && (
            <Badge variant="secondary" className="text-xs font-normal">
              {brandSummary.product_category}
            </Badge>
          )}
          {!brandSummary.tone && !brandSummary.demographic && !brandSummary.product_category && (
            <span className="text-xs text-muted-foreground">No brand data available. Click Edit to add.</span>
          )}
        </CardContent>
      )}

      {/* Expanded: full edit form */}
      {expanded && draft && (
        <CardContent className="flex flex-col gap-5 pb-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Tone */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Tone</Label>
              <Input
                value={draft.tone}
                onChange={(e) => patch("tone", e.target.value)}
                placeholder="e.g. confident, playful, aspirational"
                className="h-8 text-sm"
              />
            </div>

            {/* Demographic */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Target Demographic</Label>
              <Input
                value={draft.demographic}
                onChange={(e) => patch("demographic", e.target.value)}
                placeholder="e.g. women 25-35 interested in fitness"
                className="h-8 text-sm"
              />
            </div>

            {/* Product Category */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Product Category</Label>
              <Input
                value={draft.product_category ?? ""}
                onChange={(e) => patch("product_category", e.target.value)}
                placeholder="e.g. skincare, supplements, apparel"
                className="h-8 text-sm"
              />
            </div>

            {/* Tagline */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Tagline</Label>
              <Input
                value={draft.tagline ?? ""}
                onChange={(e) => patch("tagline", e.target.value)}
                placeholder="e.g. Feel the difference in 30 days"
                className="h-8 text-sm"
              />
            </div>

            {/* Social Proof */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Social Proof</Label>
              <Input
                value={draft.social_proof ?? ""}
                onChange={(e) => patch("social_proof", e.target.value)}
                placeholder="e.g. 10,000+ happy customers"
                className="h-8 text-sm"
              />
            </div>

            {/* Price Positioning */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium">Price Positioning</Label>
              <Select
                value={draft.price_positioning ?? ""}
                onValueChange={(val) => patch("price_positioning", val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select positioning..." />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_POSITIONING_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unique Value Prop */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Unique Value Proposition</Label>
            <Textarea
              value={draft.unique_value_prop ?? ""}
              onChange={(e) => patch("unique_value_prop", e.target.value)}
              placeholder="What makes this product stand out from competitors?"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Competitor Positioning */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Competitor Positioning</Label>
            <Textarea
              value={draft.competitor_positioning ?? ""}
              onChange={(e) => patch("competitor_positioning", e.target.value)}
              placeholder="How does this product compare to competitors?"
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Selling Points */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Key Selling Points</Label>
            <TagList
              items={draft.selling_points ?? []}
              onChange={(next) => patch("selling_points", next)}
              placeholder="Add a selling point, press Enter"
            />
          </div>

          {/* Customer Pain Points */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium">Customer Pain Points</Label>
            <TagList
              items={draft.customer_pain_points ?? []}
              onChange={(next) => patch("customer_pain_points", next)}
              placeholder="Add a pain point, press Enter"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
