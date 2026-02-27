'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, Sparkles, Check, User, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callEdge } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { usePersonaBuilderStore } from '@/stores/persona-builder';
import {
  skinTones,
  hairColors,
  hairStyles,
  eyeColors,
  personaBodyTypes,
  clothingStyles,
  accessories as accessoryOptions,
  personaAgeRanges,
  personaGenders,
} from '@/schemas/persona';

const ageRangeLabels: Record<string, string> = {
  '18_25': '18-25',
  '25_35': '25-35',
  '35_45': '35-45',
  '45_55': '45-55',
  '55_plus': '55+',
};

const genderLabels: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Non-Binary',
};

const bodyTypeLabels: Record<string, string> = {
  slim: 'Slim',
  average: 'Average',
  athletic: 'Athletic',
  curvy: 'Curvy',
  plus_size: 'Plus Size',
};

interface PersonaBuilderInlineProps {
  onSaved: (personaId: string) => void;
  onCancel?: () => void;
}

export function PersonaBuilderInline({ onSaved, onCancel }: PersonaBuilderInlineProps) {
  const store = usePersonaBuilderStore();
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());

  async function handleGenerate() {
    if (!store.name.trim()) return;
    store.setIsGenerating(true);
    setImageLoadErrors(new Set());
    toast.info('Generating persona images...');

    try {
      const attributes = {
        gender: store.gender,
        skin_tone: store.skinTone,
        age: store.ageRange,
        hair_color: store.hairColor,
        hair_style: store.hairStyle,
        eye_color: store.eyeColor,
        body_type: store.bodyType,
        clothing_style: store.clothingStyle,
        accessories: store.accessories,
      };

      const result = await callEdge<{
        data: { id: string; generated_images: string[]; generated_image_urls: string[] };
      }>('generate-persona', {
        body: {
          name: store.name,
          attributes,
          ...(store.personaId ? { persona_id: store.personaId } : {}),
        },
      });

      const displayUrls = result.data.generated_image_urls ?? result.data.generated_images;
      store.setPersonaId(result.data.id);
      store.setGeneratedImages(displayUrls);
      toast.success(`${displayUrls.length} persona images generated!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate persona');
    } finally {
      store.setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (store.selectedImageIndex === null || !store.personaId) return;
    store.setIsSaving(true);
    const savedPersonaId = store.personaId;

    try {
      await callEdge('select-persona-image', {
        body: { persona_id: store.personaId, image_index: store.selectedImageIndex },
      });
      toast.success('Persona saved!');
      store.reset();
      onSaved(savedPersonaId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save persona');
      store.setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {onCancel && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Configure your AI persona</p>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="size-4" />
            Back to library
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: attribute controls */}
        <fieldset disabled={store.isGenerating || store.isSaving}>
          <div className={cn(
            'flex flex-col gap-4 transition-opacity',
            (store.isGenerating || store.isSaving) && 'pointer-events-none opacity-60',
          )}>
            {/* Name */}
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                <Label htmlFor="inline-persona-name">Persona Name</Label>
                <Input
                  id="inline-persona-name"
                  placeholder="e.g. Sophie, Marcus"
                  value={store.name}
                  onChange={(e) => store.setField('name', e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Gender */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Gender
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-3 gap-2">
                  {personaGenders.map((g) => (
                    <button
                      key={g}
                      onClick={() => store.setField('gender', g)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                        store.gender === g
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {genderLabels[g]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Skin Tone */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Skin Tone
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-3">
                  {skinTones.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => store.setField('skinTone', tone)}
                      className={cn(
                        'size-9 rounded-full border-2 transition-all',
                        store.skinTone === tone
                          ? 'scale-110 border-primary ring-2 ring-primary/30'
                          : 'border-transparent hover:scale-105',
                      )}
                      style={{ backgroundColor: tone }}
                      title={tone}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Age Range */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Age Range
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {personaAgeRanges.map((range) => (
                    <button
                      key={range}
                      onClick={() => store.setField('ageRange', range)}
                      className={cn(
                        'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                        store.ageRange === range
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {ageRangeLabels[range]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hair Color */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hair Color
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {hairColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => store.setField('hairColor', color)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        store.hairColor === color
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Hair Style */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hair Style
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {hairStyles.map((style) => (
                    <button
                      key={style}
                      onClick={() => store.setField('hairStyle', style)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        store.hairStyle === style
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Eye Color */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Eye Color
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {eyeColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => store.setField('eyeColor', color)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        store.eyeColor === color
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Body Type */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Body Type
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {personaBodyTypes.map((type) => (
                    <button
                      key={type}
                      onClick={() => store.setField('bodyType', type)}
                      className={cn(
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                        store.bodyType === type
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {bodyTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Clothing Style */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Clothing Style
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {clothingStyles.map((style) => (
                    <button
                      key={style}
                      onClick={() => store.setField('clothingStyle', style)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                        store.clothingStyle === style
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                      )}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Accessories */}
            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Accessories{' '}
                  <span className="normal-case font-normal">(max 5)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="flex flex-wrap gap-2">
                  {accessoryOptions.map((acc) => {
                    const isSelected = store.accessories.includes(acc);
                    return (
                      <button
                        key={acc}
                        onClick={() => store.toggleAccessory(acc)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                        )}
                      >
                        {isSelected && <Check className="mr-1 inline size-3" />}
                        {acc}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </fieldset>

        {/* Right: preview + generate */}
        <div className="flex flex-col gap-4">
          <div className="sticky top-6">
            {/* Loading skeleton while generating */}
            {store.isGenerating && store.generatedImages.length === 0 && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Generating Persona...</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    This may take up to 30 seconds...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Attribute summary (before generating) */}
            {store.generatedImages.length === 0 && !store.isGenerating && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Persona Preview</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex size-16 items-center justify-center self-center rounded-full bg-muted">
                    <User className="size-7 text-muted-foreground" />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Name</span>
                      <p className="font-medium">{store.name || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Gender</span>
                      <p className="font-medium">{genderLabels[store.gender]}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Age</span>
                      <p className="font-medium">{ageRangeLabels[store.ageRange]}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Body</span>
                      <p className="font-medium">{bodyTypeLabels[store.bodyType]}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Hair</span>
                      <p className="font-medium">{store.hairColor}, {store.hairStyle}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Eyes</span>
                      <p className="font-medium">{store.eyeColor}</p>
                    </div>
                  </div>
                  {store.accessories.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex flex-wrap gap-1">
                        {store.accessories.map((acc) => (
                          <Badge key={acc} variant="secondary" className="text-xs">
                            {acc}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Generated image picker */}
            {store.generatedImages.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Choose Your Persona</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    {store.generatedImages.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => store.selectImage(index)}
                        className={cn(
                          'relative aspect-square overflow-hidden rounded-lg border-2 bg-muted transition-all',
                          store.selectedImageIndex === index
                            ? 'border-primary ring-2 ring-primary/30'
                            : 'border-transparent hover:border-muted-foreground/30',
                        )}
                      >
                        {imageLoadErrors.has(index) ? (
                          <div className="flex size-full items-center justify-center">
                            <ImageIcon className="size-8 text-muted-foreground" />
                          </div>
                        ) : (
                          <Image
                            src={url}
                            alt={`Persona option ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 160px"
                            onError={() =>
                              setImageLoadErrors((prev) => new Set(prev).add(index))
                            }
                          />
                        )}
                        {store.selectedImageIndex === index && (
                          <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary">
                            <Check className="size-3.5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex flex-col gap-3">
              {store.generatedImages.length === 0 ? (
                <Button
                  onClick={handleGenerate}
                  disabled={!store.name.trim() || store.isGenerating}
                  className="w-full"
                  size="lg"
                >
                  {store.isGenerating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating Persona...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" />
                      Generate Persona
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleSave}
                    disabled={
                      store.selectedImageIndex === null ||
                      !store.personaId ||
                      store.isSaving
                    }
                    className="w-full"
                    size="lg"
                  >
                    {store.isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="size-4" />
                        Use This Persona
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    variant="outline"
                    disabled={store.isGenerating || store.isSaving}
                    className="w-full"
                  >
                    {store.isGenerating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Regenerate
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
