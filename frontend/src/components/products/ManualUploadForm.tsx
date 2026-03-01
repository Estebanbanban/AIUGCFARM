'use client';

import { useState, useRef, useCallback } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { callEdgeMultipart } from '@/lib/api';
import { createProductSchema } from '@/schemas/product';

const MAX_FILES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface ManualUploadFormProps {
  onSuccess: () => void;
}

interface SelectedFile {
  file: File;
  preview: string;
}

export function ManualUploadForm({ onSuccess }: ManualUploadFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [category, setCategory] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newFiles: SelectedFile[] = [];
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        if (!file.type.startsWith('image/')) {
          toast.error(`"${file.name}" is not an image file`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds 5MB limit`);
          continue;
        }
        if (selectedFiles.length + newFiles.length >= MAX_FILES) {
          toast.error(`Maximum ${MAX_FILES} images allowed`);
          break;
        }
        newFiles.push({
          file,
          preview: URL.createObjectURL(file),
        });
      }

      if (newFiles.length > 0) {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
      }
    },
    [selectedFiles.length]
  );

  function removeFile(index: number) {
    setSelectedFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate with Zod schema
    const parsed = createProductSchema.safeParse({
      name,
      description: description || undefined,
      price: price ? parseFloat(price) : undefined,
      currency,
      category: category || undefined,
      source: 'manual' as const,
      confirmed: false,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      toast.error(firstIssue?.message ?? 'Validation failed');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build multipart form data with product fields + image files
      const formData = new FormData();
      formData.append('name', parsed.data.name);
      if (parsed.data.description) formData.append('description', parsed.data.description);
      if (parsed.data.price !== undefined) formData.append('price', String(parsed.data.price));
      formData.append('currency', parsed.data.currency ?? 'USD');
      if (parsed.data.category) formData.append('category', parsed.data.category);
      for (const sf of selectedFiles) {
        formData.append('images', sf.file);
      }

      await callEdgeMultipart('upload-product', formData);

      toast.success('Product uploaded successfully!');

      // Cleanup previews
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));

      // Reset form
      setName('');
      setDescription('');
      setPrice('');
      setCurrency('USD');
      setCategory('');
      setSelectedFiles([]);

      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to upload product';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-name">
          Product Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="manual-name"
          placeholder="e.g. Vitamin C Serum"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-description">Description</Label>
        <Textarea
          id="manual-description"
          placeholder="Describe your product..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
        />
      </div>

      {/* Price + Currency */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-price">Price</Label>
          <Input
            id="manual-price"
            type="number"
            min="0"
            step="0.01"
            placeholder="29.99"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="manual-currency">Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="manual-category">Category</Label>
        <Input
          id="manual-category"
          placeholder="e.g. Skincare, Electronics..."
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
      </div>

      {/* Image Upload Area */}
      <div className="flex flex-col gap-1.5">
        <Label>Product Images</Label>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_FILES} images, max 5MB each
        </p>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          <Upload className="size-6 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Click to browse or drag and drop
            </p>
            <p className="text-xs text-muted-foreground/70">
              PNG, JPG, WEBP accepted
            </p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Uploaded Thumbnails */}
        {selectedFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedFiles.map((sf, index) => (
              <div key={index} className="group relative size-16">
                <img
                  src={sf.preview}
                  alt={sf.file.name}
                  className="size-full rounded-md object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={!name.trim() || isSubmitting}
        className="bg-primary hover:bg-primary/90"
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
    </form>
  );
}
