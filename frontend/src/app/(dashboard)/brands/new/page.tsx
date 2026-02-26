"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Globe, Loader2, Plus, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useCreateBrand } from "@/hooks/use-brands";

export default function NewBrandPage() {
  const router = useRouter();
  const createBrand = useCreateBrand();

  const [analyzeUrl, setAnalyzeUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [toneOfVoice, setToneOfVoice] = useState("");
  const [targetDemographic, setTargetDemographic] = useState("");
  const [sellingPoints, setSellingPoints] = useState<string[]>([]);
  const [newSellingPoint, setNewSellingPoint] = useState("");

  function handleAnalyze() {
    if (!analyzeUrl.trim()) return;
    setIsAnalyzing(true);
    // Simulate analysis
    setTimeout(() => {
      setName("Example Store");
      setUrl(analyzeUrl);
      setToneOfVoice("Friendly & Professional");
      setTargetDemographic("Young adults 25-35");
      setSellingPoints(["Free shipping", "100% natural ingredients"]);
      setIsAnalyzing(false);
    }, 2000);
  }

  function addSellingPoint() {
    const trimmed = newSellingPoint.trim();
    if (trimmed && sellingPoints.length < 10) {
      setSellingPoints([...sellingPoints, trimmed]);
      setNewSellingPoint("");
    }
  }

  function removeSellingPoint(index: number) {
    setSellingPoints(sellingPoints.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await createBrand.mutateAsync({
        name: name.trim(),
        url: url.trim() || undefined,
        tone_of_voice: toneOfVoice.trim() || undefined,
        target_demographic: targetDemographic.trim() || undefined,
        key_selling_points:
          sellingPoints.length > 0 ? sellingPoints : undefined,
      });
      if (result) {
        router.push(`/dashboard/brands/${result.id}`);
      }
    } catch {
      // Error handled by mutation
    }
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Import Store
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Add a new brand by URL or manually.
          </p>
        </div>
      </div>

      {/* Auto-Analyze Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Globe className="size-5 text-violet-500" />
            Analyze Store URL
          </CardTitle>
          <CardDescription>
            Paste your store URL and we will automatically extract brand
            details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="https://your-store.com"
              value={analyzeUrl}
              onChange={(e) => setAnalyzeUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !analyzeUrl.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Store"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase text-muted-foreground">
          or fill manually
        </span>
        <Separator className="flex-1" />
      </div>

      {/* Manual Form */}
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">
                Brand Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="name"
                placeholder="My Awesome Brand"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                placeholder="https://your-store.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="tone">Tone of Voice</Label>
              <Input
                id="tone"
                placeholder="e.g. Friendly, Professional, Energetic"
                value={toneOfVoice}
                onChange={(e) => setToneOfVoice(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="demographic">Target Demographic</Label>
              <Textarea
                id="demographic"
                placeholder="e.g. Women aged 25-35 interested in skincare"
                value={targetDemographic}
                onChange={(e) => setTargetDemographic(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Key Selling Points</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Free shipping, 100% organic"
                  value={newSellingPoint}
                  onChange={(e) => setNewSellingPoint(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addSellingPoint();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={addSellingPoint}
                  disabled={!newSellingPoint.trim() || sellingPoints.length >= 10}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {sellingPoints.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {sellingPoints.map((point, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="gap-1 pr-1.5"
                    >
                      {point}
                      <button
                        type="button"
                        onClick={() => removeSellingPoint(i)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button asChild variant="outline">
                <Link href="/dashboard/brands">Cancel</Link>
              </Button>
              <Button
                type="submit"
                disabled={!name.trim() || createBrand.isPending}
                className="bg-violet-600 hover:bg-violet-700"
              >
                {createBrand.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Brand"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
