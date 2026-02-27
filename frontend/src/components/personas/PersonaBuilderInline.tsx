'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Loader2, Sparkles, Check, User, ImageIcon, X,
  ChevronDown, ChevronUp, Eye, Palette, Clock,
  Shirt, Watch,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { callEdge } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// ── Label maps ──────────────────────────────────────────────────────────────

const ageRangeLabels: Record<string, string> = {
  '18_25': '18–25',
  '25_35': '25–35',
  '35_45': '35–45',
  '45_55': '45–55',
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

// Gradient placeholders — swap the inner div for <Image fill .../> per option once photos are ready
const hairPlaceholderStyle: Record<string, React.CSSProperties> = {
  'Black':       { background: 'linear-gradient(135deg,#18181b 0%,#09090b 100%)' },
  'Dark Brown':  { background: 'linear-gradient(135deg,#3b1f0a 0%,#1c0f05 100%)' },
  'Light Brown': { background: 'linear-gradient(135deg,#92400e 0%,#451a03 100%)' },
  'Blonde':      { background: 'linear-gradient(135deg,#fde68a 0%,#d97706 100%)' },
  'Red':         { background: 'linear-gradient(135deg,#dc2626 0%,#7f1d1d 100%)' },
  'Auburn':      { background: 'linear-gradient(135deg,#c2410c 0%,#431407 100%)' },
  'Gray':        { background: 'linear-gradient(135deg,#71717a 0%,#3f3f46 100%)' },
  'White':       { background: 'linear-gradient(135deg,#e4e4e7 0%,#a1a1aa 100%)' },
  'Pink':        { background: 'linear-gradient(135deg,#f472b6 0%,#9d174d 100%)' },
  'Blue':        { background: 'linear-gradient(135deg,#3b82f6 0%,#1e3a8a 100%)' },
};

const eyePlaceholderStyle: Record<string, React.CSSProperties> = {
  'Brown': { background: 'linear-gradient(135deg,#92400e 0%,#451a03 100%)' },
  'Blue':  { background: 'linear-gradient(135deg,#3b82f6 0%,#1e3a8a 100%)' },
  'Green': { background: 'linear-gradient(135deg,#16a34a 0%,#14532d 100%)' },
  'Hazel': { background: 'linear-gradient(135deg,#d97706 0%,#78350f 100%)' },
  'Gray':  { background: 'linear-gradient(135deg,#71717a 0%,#3f3f46 100%)' },
  'Amber': { background: 'linear-gradient(135deg,#f59e0b 0%,#b45309 100%)' },
};

const LIME = '#b5f23d';

// ── Shared sub-components ───────────────────────────────────────────────────

function Section({
  icon,
  label,
  count,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-0.5"
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 text-left text-sm font-medium text-white">
          {label}
          {count !== undefined && (
            <span className="ml-1.5 text-zinc-500">· {count}</span>
          )}
        </span>
        {open
          ? <ChevronUp className="size-4 text-zinc-600" />
          : <ChevronDown className="size-4 text-zinc-600" />}
      </button>
      {open && (
        <div className="rounded-2xl bg-zinc-900 p-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Full-image option card with label + selected lime ring */
function ImageCard({
  label,
  selected,
  onClick,
  placeholderStyle,
  aspect = 'aspect-[3/4]',
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  placeholderStyle?: React.CSSProperties;
  aspect?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-xl transition-all duration-150',
        aspect,
        selected
          ? 'ring-2 ring-[#b5f23d]'
          : 'ring-1 ring-white/5 hover:ring-white/15',
      )}
    >
      {/* Placeholder — swap with <Image fill .../> when photo is ready */}
      <div
        className="absolute inset-0 bg-zinc-800"
        style={placeholderStyle}
      />

      {/* Bottom gradient for label legibility */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 to-transparent" />

      {/* Label row */}
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
        {selected && (
          <div
            className="flex size-5 flex-shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: LIME }}
          >
            <Check className="size-3 text-black" strokeWidth={3} />
          </div>
        )}
        <span className="text-sm font-semibold leading-none text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">
          {label}
        </span>
      </div>
    </button>
  );
}

/** Text-only option card (age range, body type) */
function TextCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border py-3 text-sm font-medium transition-all',
        selected
          ? 'border-[#b5f23d] bg-[#b5f23d]/10 text-[#b5f23d]'
          : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-white',
      )}
    >
      {label}
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

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
    toast.info('Generating persona images…');

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

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">

        {/* ── Left: Sims-style criteria builder ─────────────────────── */}
        <fieldset disabled={store.isGenerating || store.isSaving} className="min-w-0">
          <div className={cn(
            'flex flex-col gap-5 transition-opacity',
            (store.isGenerating || store.isSaving) && 'pointer-events-none opacity-50',
          )}>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Persona Name
              </Label>
              <Input
                placeholder="e.g. Sophie, Marcus"
                value={store.name}
                onChange={(e) => store.setField('name', e.target.value)}
                className="border-white/10 bg-zinc-900 text-white placeholder:text-zinc-600"
              />
            </div>

            {/* Gender */}
            <Section
              icon={<User className="size-4 text-cyan-400" />}
              label="Gender"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2">
                {personaGenders.map((g) => (
                  <ImageCard
                    key={g}
                    label={genderLabels[g]}
                    selected={store.gender === g}
                    onClick={() => store.setField('gender', g)}
                  />
                ))}
              </div>
            </Section>

            {/* Skin Tone */}
            <Section
              icon={<Palette className="size-4 text-[#b5f23d]" />}
              label="Skin Tone"
              count={1}
            >
              <div className="grid grid-cols-6 gap-2">
                {skinTones.map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => store.setField('skinTone', tone)}
                    className={cn(
                      'aspect-square rounded-xl transition-all duration-150',
                      store.skinTone === tone
                        ? 'scale-105 ring-[3px] ring-[#b5f23d]'
                        : 'ring-1 ring-white/5 hover:scale-105 hover:ring-white/20',
                    )}
                    style={{ backgroundColor: tone }}
                  />
                ))}
              </div>
            </Section>

            {/* Age Range */}
            <Section
              icon={<Clock className="size-4 text-sky-400" />}
              label="Age Range"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {personaAgeRanges.map((range) => (
                  <TextCard
                    key={range}
                    label={ageRangeLabels[range]}
                    selected={store.ageRange === range}
                    onClick={() => store.setField('ageRange', range)}
                  />
                ))}
              </div>
            </Section>

            {/* Hair Color */}
            <Section
              icon={<Palette className="size-4 text-amber-400" />}
              label="Hair Color"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {hairColors.map((color) => (
                  <ImageCard
                    key={color}
                    label={color}
                    selected={store.hairColor === color}
                    onClick={() => store.setField('hairColor', color)}
                    placeholderStyle={hairPlaceholderStyle[color]}
                    aspect="aspect-square"
                  />
                ))}
              </div>
            </Section>

            {/* Hair Style */}
            <Section
              icon={<User className="size-4 text-orange-400" />}
              label="Hair Style"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2">
                {hairStyles.map((style) => (
                  <ImageCard
                    key={style}
                    label={style}
                    selected={store.hairStyle === style}
                    onClick={() => store.setField('hairStyle', style)}
                  />
                ))}
              </div>
            </Section>

            {/* Eye Color */}
            <Section
              icon={<Eye className="size-4 text-purple-400" />}
              label="Eye Color"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2">
                {eyeColors.map((color) => (
                  <ImageCard
                    key={color}
                    label={color}
                    selected={store.eyeColor === color}
                    onClick={() => store.setField('eyeColor', color)}
                    placeholderStyle={eyePlaceholderStyle[color]}
                    aspect="aspect-square"
                  />
                ))}
              </div>
            </Section>

            {/* Body Type */}
            <Section
              icon={<User className="size-4 text-blue-400" />}
              label="Body Type"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {personaBodyTypes.map((type) => (
                  <TextCard
                    key={type}
                    label={bodyTypeLabels[type]}
                    selected={store.bodyType === type}
                    onClick={() => store.setField('bodyType', type)}
                  />
                ))}
              </div>
            </Section>

            {/* Clothing Style */}
            <Section
              icon={<Shirt className="size-4 text-rose-400" />}
              label="Clothing Style"
              count={1}
            >
              <div className="grid grid-cols-3 gap-2">
                {clothingStyles.map((style) => (
                  <ImageCard
                    key={style}
                    label={style}
                    selected={store.clothingStyle === style}
                    onClick={() => store.setField('clothingStyle', style)}
                  />
                ))}
              </div>
            </Section>

            {/* Accessories — multi-select */}
            <Section
              icon={<Watch className="size-4 text-yellow-400" />}
              label="Accessories"
              count={store.accessories.length}
            >
              <p className="mb-2 text-xs text-zinc-500">Select up to 5</p>
              <div className="flex flex-wrap gap-2">
                {accessoryOptions.map((acc) => {
                  const isSelected = store.accessories.includes(acc);
                  return (
                    <button
                      key={acc}
                      type="button"
                      onClick={() => store.toggleAccessory(acc)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        isSelected
                          ? 'border-[#b5f23d] bg-[#b5f23d]/10 text-[#b5f23d]'
                          : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-white',
                      )}
                    >
                      {isSelected && <Check className="mr-1 inline size-3" strokeWidth={3} />}
                      {acc}
                    </button>
                  );
                })}
              </div>
            </Section>

          </div>
        </fieldset>

        {/* ── Right: preview + generate ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="sticky top-6">

            {/* Generating skeleton */}
            {store.isGenerating && store.generatedImages.length === 0 && (
              <div className="rounded-2xl bg-zinc-900 p-4">
                <p className="mb-3 text-sm font-medium text-white">Generating…</p>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-800" />
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-zinc-500">
                  May take up to 30 seconds
                </p>
              </div>
            )}

            {/* Attribute summary (before generating) */}
            {store.generatedImages.length === 0 && !store.isGenerating && (
              <div className="rounded-2xl bg-zinc-900 p-4">
                <p className="mb-3 text-sm font-medium text-white">Persona Preview</p>
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-zinc-800">
                  <User className="size-6 text-zinc-500" />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {[
                    { label: 'Name',   value: store.name || 'Not set' },
                    { label: 'Gender', value: genderLabels[store.gender] },
                    { label: 'Age',    value: ageRangeLabels[store.ageRange] },
                    { label: 'Hair',   value: `${store.hairColor}, ${store.hairStyle}` },
                    { label: 'Eyes',   value: store.eyeColor },
                    { label: 'Body',   value: bodyTypeLabels[store.bodyType] },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-zinc-500">{label}</p>
                      <p className="truncate font-medium text-white">{value}</p>
                    </div>
                  ))}
                </div>
                {store.accessories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-white/5 pt-3">
                    {store.accessories.map((acc) => (
                      <span
                        key={acc}
                        className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-zinc-400"
                      >
                        {acc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generated image picker */}
            {store.generatedImages.length > 0 && (
              <div className="rounded-2xl bg-zinc-900 p-4">
                <p className="mb-3 text-sm font-medium text-white">Choose Your Persona</p>
                <div className="grid grid-cols-2 gap-2">
                  {store.generatedImages.map((url, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => store.selectImage(index)}
                      className={cn(
                        'relative aspect-square overflow-hidden rounded-xl transition-all',
                        store.selectedImageIndex === index
                          ? 'ring-2 ring-[#b5f23d]'
                          : 'ring-1 ring-white/5 hover:ring-white/20',
                      )}
                    >
                      {imageLoadErrors.has(index) ? (
                        <div className="flex size-full items-center justify-center bg-zinc-800">
                          <ImageIcon className="size-8 text-zinc-600" />
                        </div>
                      ) : (
                        <Image
                          src={url}
                          alt={`Persona option ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 140px"
                          onError={() =>
                            setImageLoadErrors((prev) => new Set(prev).add(index))
                          }
                        />
                      )}
                      {store.selectedImageIndex === index && (
                        <div
                          className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full"
                          style={{ backgroundColor: LIME }}
                        >
                          <Check className="size-3 text-black" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-4 flex flex-col gap-3">
              {store.generatedImages.length === 0 ? (
                <Button
                  onClick={handleGenerate}
                  disabled={!store.name.trim() || store.isGenerating}
                  className="w-full bg-[#b5f23d] font-semibold text-black hover:bg-[#a0e030]"
                  size="lg"
                >
                  {store.isGenerating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Generating…
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
                    disabled={store.selectedImageIndex === null || !store.personaId || store.isSaving}
                    className="w-full bg-[#b5f23d] font-semibold text-black hover:bg-[#a0e030]"
                    size="lg"
                  >
                    {store.isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
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
                    className="w-full border-white/10 text-white hover:bg-white/5"
                  >
                    {store.isGenerating ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Regenerating…
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
