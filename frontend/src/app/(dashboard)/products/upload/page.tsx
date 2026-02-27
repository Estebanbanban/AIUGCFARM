"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
];

async function uploadProduct(formData: FormData) {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/upload-product`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

interface PreviewFile {
  file: File;
  preview: string;
}

export default function ProductUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndAddFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const errors: string[] = [];
      const validFiles: PreviewFile[] = [];

      for (const file of fileArray) {
        if (files.length + validFiles.length >= MAX_FILES) {
          errors.push(`Maximum ${MAX_FILES} images allowed`);
          break;
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          errors.push(`${file.name}: Only JPEG, PNG, and WebP files are allowed`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          errors.push(`${file.name}: File must be under 5MB`);
          continue;
        }
        validFiles.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }

      if (errors.length > 0) {
        toast.error(errors[0]);
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles].slice(0, MAX_FILES));
      }
    },
    [files.length]
  );

  function removeFile(index: number) {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset file input so the same file can be selected again
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", name.trim());
      if (description.trim()) formData.append("description", description.trim());
      if (price) formData.append("price", price);
      formData.append("currency", currency);
      formData.append("source", "manual");

      files.forEach((f) => {
        formData.append("images", f.file);
      });

      await uploadProduct(formData);
      toast.success("Product uploaded successfully!");
      router.push("/products");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload product"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Products
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            Upload Product
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a product manually by uploading images and filling in details.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        {/* Image Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
                isDragOver
                  ? "border-violet-500 bg-violet-500/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Drag & drop images here
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                or click to browse. JPEG, PNG, or WebP. Max 5MB each.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {files.length}/{MAX_FILES} images
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Image previews */}
            {files.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-3">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="group relative aspect-square rounded-lg bg-muted overflow-hidden"
                  >
                    <img
                      src={f.preview}
                      alt={`Upload ${i + 1}`}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Vitamin C Brightening Serum"
                required
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="product-description">Description</Label>
              <Textarea
                id="product-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product..."
                rows={4}
              />
            </div>

            {/* Price & Currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="product-price">Price</Label>
                <Input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                className="bg-violet-600 hover:bg-violet-700"
                disabled={isSubmitting || !name.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="size-4" />
                    Upload Product
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/products")}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
