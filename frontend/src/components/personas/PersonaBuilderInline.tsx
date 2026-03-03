'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { resolvePersonaImageUrl } from '@/hooks/use-personas';
import Image from 'next/image';
import {
  Loader2, Sparkles, Check, User, ImageIcon, X,
  ChevronDown, ChevronUp, Eye, Palette, Clock,
  Shirt, Watch, Wand2, Cpu, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { callEdge } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { NanoBananaLoader } from '@/components/ui/nano-loader';
import { usePersonaBuilderStore } from '@/stores/persona-builder';
import { useProfile } from '@/hooks/use-profile';
import {
  ethnicities,
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

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function neutralCardStyle(key: string, isDark = false): React.CSSProperties {
  const lightPalettes: Array<[string, string, string]> = [
    ['#f5f5f4', '#e7e5e4', '#d6d3d1'],
    ['#f8fafc', '#e2e8f0', '#cbd5e1'],
    ['#f4f4f5', '#e4e4e7', '#d4d4d8'],
    ['#f8fafc', '#e5e7eb', '#d1d5db'],
    ['#f5f5f5', '#e7e5e4', '#d4d4d4'],
    ['#fafaf9', '#e7e5e4', '#d6d3d1'],
  ];
  const darkPalettes: Array<[string, string, string]> = [
    ['#292524', '#44403c', '#57534e'],
    ['#1e293b', '#334155', '#475569'],
    ['#27272a', '#3f3f46', '#52525b'],
    ['#1e293b', '#374151', '#4b5563'],
    ['#292524', '#44403c', '#57534e'],
    ['#1c1917', '#44403c', '#57534e'],
  ];

  const palettes = isDark ? darkPalettes : lightPalettes;
  const idx = hashString(key) % palettes.length;
  const [base, shade, accent] = palettes[idx];

  return {
    backgroundColor: base,
    backgroundImage: [
      `radial-gradient(circle at 18% 22%, ${accent}66 0%, transparent 34%)`,
      `radial-gradient(circle at 80% 16%, ${shade}80 0%, transparent 30%)`,
      `linear-gradient(165deg, ${base} 0%, ${shade} 62%, ${accent} 100%)`,
    ].join(','),
  };
}

function optionImageDataUri(key: string, isDark = false) {
  const seed = hashString(key);
  const lightPalettes = [
    ['#f8fafc', '#e2e8f0', '#cbd5e1'],
    ['#fafaf9', '#e7e5e4', '#d6d3d1'],
    ['#f5f5f4', '#e7e5e4', '#d4d4d4'],
    ['#f4f4f5', '#e4e4e7', '#d4d4d8'],
  ] as const;
  const darkPalettes = [
    ['#1e293b', '#334155', '#475569'],
    ['#1c1917', '#292524', '#44403c'],
    ['#18181b', '#27272a', '#3f3f46'],
    ['#18181b', '#27272a', '#3f3f46'],
  ] as const;
  const palettes = isDark ? darkPalettes : lightPalettes;
  const [bg1, bg2, bg3] = palettes[seed % palettes.length];
  const wave = 240 + (seed % 60);
  const eye = 188 + (seed % 18);

  // Dark-mode swapped fill colours
  const hairFill1 = isDark ? '#52525b' : '#d4d4d8';
  const hairFill2 = isDark ? '#4b5563' : '#d1d5db';
  const clothingFill = isDark ? '#475569' : '#cbd5e1';

  const parseKind = () => {
    if (key.startsWith('gender-')) return { kind: 'gender', value: key.slice(7) };
    if (key.startsWith('hair-style-')) return { kind: 'hairStyle', value: key.slice(11) };
    if (key.startsWith('body-type-')) return { kind: 'bodyType', value: key.slice(10) };
    if (key.startsWith('clothing-')) return { kind: 'clothing', value: key.slice(9) };
    if (key.startsWith('accessory-')) return { kind: 'accessory', value: key.slice(10) };
    return { kind: 'generic', value: key };
  };

  const { kind, value } = parseKind();
  const normalized = value.toLowerCase().replace(/_/g, ' ');

  let hair = `<path d="M292 256c0-62 48-104 108-104s108 42 108 104v30H292z" fill="${hairFill1}" opacity="0.85"/>`;
  let torso = '<rect x="245" y="420" width="310" height="380" rx="150" fill="#ffffff" opacity="0.82"/>';
  let clothing = '';
  let accessory = '';

  if (kind === 'gender') {
    if (normalized === 'male') {
      hair = `<path d="M300 248c0-56 44-96 100-96s100 40 100 96v24H300z" fill="${hairFill2}" opacity="0.88"/>`;
      torso = '<rect x="230" y="420" width="340" height="370" rx="120" fill="#ffffff" opacity="0.82"/>';
    } else if (normalized === 'female') {
      hair = `<path d="M280 244c0-62 54-104 120-104s120 42 120 104v120H280z" fill="${hairFill2}" opacity="0.9"/>`;
      torso = '<rect x="255" y="430" width="290" height="370" rx="145" fill="#ffffff" opacity="0.82"/>';
    } else {
      hair = `<path d="M290 248c0-60 50-100 110-100s110 40 110 100v54H290z" fill="${hairFill1}" opacity="0.88"/>`;
      torso = '<rect x="242" y="424" width="316" height="374" rx="134" fill="#ffffff" opacity="0.82"/>';
    }
  }

  if (kind === 'hairStyle') {
    if (normalized.includes('bald')) {
      hair = '';
    } else if (normalized.includes('buzz')) {
      hair = `<path d="M314 252c0-50 38-84 86-84s86 34 86 84v10H314z" fill="${hairFill1}" opacity="0.92"/>`;
    } else if (normalized.includes('afro')) {
      hair = `<circle cx="400" cy="248" r="132" fill="${hairFill1}" opacity="0.88"/>`;
    } else if (normalized.includes('braids')) {
      hair = `<path d="M286 246c0-60 52-102 114-102s114 42 114 102v78H286z" fill="${hairFill1}" opacity="0.9"/><rect x="292" y="292" width="30" height="180" rx="15" fill="${hairFill1}"/><rect x="478" y="292" width="30" height="180" rx="15" fill="${hairFill1}"/>`;
    } else if (normalized.includes('ponytail')) {
      hair = `<path d="M286 246c0-60 52-102 114-102s114 42 114 102v82H286z" fill="${hairFill1}" opacity="0.9"/><rect x="502" y="274" width="42" height="120" rx="20" fill="${hairFill1}"/>`;
    } else if (normalized.includes('bob')) {
      hair = `<path d="M286 246c0-60 52-102 114-102s114 42 114 102v132H286z" fill="${hairFill1}" opacity="0.9"/>`;
    } else if (normalized.includes('long')) {
      hair = `<path d="M278 246c0-60 54-102 122-102s122 42 122 102v168H278z" fill="${hairFill1}" opacity="0.9"/>`;
    } else if (normalized.includes('medium')) {
      hair = `<path d="M282 246c0-60 52-102 118-102s118 42 118 102v122H282z" fill="${hairFill1}" opacity="0.9"/>`;
    } else {
      hair = `<path d="M292 252c0-58 48-98 108-98s108 40 108 98v72H292z" fill="${hairFill1}" opacity="0.9"/>`;
    }
  }

  if (kind === 'bodyType') {
    if (normalized.includes('slim')) {
      torso = '<rect x="284" y="430" width="232" height="362" rx="118" fill="#ffffff" opacity="0.82"/>';
    } else if (normalized.includes('athletic')) {
      torso = '<path d="M240 520c0-62 52-112 116-112h88c64 0 116 50 116 112v170c0 74-60 134-134 134h-52c-74 0-134-60-134-134z" fill="#ffffff" opacity="0.82"/>';
    } else if (normalized.includes('curvy')) {
      torso = '<path d="M258 510c0-70 56-126 126-126h32c70 0 126 56 126 126v172c0 78-64 142-142 142h-0c-78 0-142-64-142-142z" fill="#ffffff" opacity="0.82"/>';
    } else if (normalized.includes('plus')) {
      torso = '<rect x="214" y="412" width="372" height="404" rx="170" fill="#ffffff" opacity="0.82"/>';
    } else {
      torso = '<rect x="245" y="420" width="310" height="380" rx="150" fill="#ffffff" opacity="0.82"/>';
    }
  }

  if (kind === 'clothing') {
    if (normalized.includes('business')) {
      clothing = `<path d="M260 532h280v238H260z" fill="${clothingFill}" opacity="0.55"/><path d="M322 532l78 100 78-100" fill="none" stroke="#94a3b8" stroke-width="14"/>`;
    } else if (normalized.includes('streetwear')) {
      clothing = `<path d="M242 542h316v210H242z" fill="${clothingFill}" opacity="0.52"/><rect x="336" y="582" width="128" height="92" rx="26" fill="#94a3b8" opacity="0.55"/>`;
    } else if (normalized.includes('sporty')) {
      clothing = `<path d="M246 534h308v226H246z" fill="${clothingFill}" opacity="0.52"/><path d="M280 564l240 176" stroke="#94a3b8" stroke-width="12" opacity="0.7"/>`;
    } else if (normalized.includes('elegant')) {
      clothing = `<path d="M300 528h200v300H300z" fill="${clothingFill}" opacity="0.5"/><path d="M300 590c52 24 148 24 200 0" stroke="#94a3b8" stroke-width="10" opacity="0.72"/>`;
    } else if (normalized.includes('bohemian')) {
      clothing = `<path d="M242 544h316v222H242z" fill="${clothingFill}" opacity="0.5"/><path d="M260 620h280M260 670h280" stroke="#94a3b8" stroke-width="8" opacity="0.55"/>`;
    } else if (normalized.includes('minimalist')) {
      clothing = `<path d="M256 540h288v214H256z" fill="${clothingFill}" opacity="0.45"/>`;
    } else {
      clothing = `<path d="M250 538h300v220H250z" fill="${clothingFill}" opacity="0.48"/>`;
    }
  }

  if (kind === 'accessory') {
    if (normalized.includes('glasses')) {
      accessory = '<rect x="334" y="192" width="40" height="26" rx="8" fill="none" stroke="#9ca3af" stroke-width="6"/><rect x="426" y="192" width="40" height="26" rx="8" fill="none" stroke="#9ca3af" stroke-width="6"/><line x1="374" y1="205" x2="426" y2="205" stroke="#9ca3af" stroke-width="6"/>';
    } else if (normalized.includes('sunglasses')) {
      accessory = '<rect x="332" y="190" width="44" height="28" rx="8" fill="#9ca3af" opacity="0.7"/><rect x="424" y="190" width="44" height="28" rx="8" fill="#9ca3af" opacity="0.7"/><line x1="376" y1="204" x2="424" y2="204" stroke="#9ca3af" stroke-width="6"/>';
    } else if (normalized.includes('earrings')) {
      accessory = '<circle cx="318" cy="252" r="10" fill="none" stroke="#9ca3af" stroke-width="5"/><circle cx="482" cy="252" r="10" fill="none" stroke="#9ca3af" stroke-width="5"/>';
    } else if (normalized.includes('necklace')) {
      accessory = '<path d="M340 374c20 24 38 36 60 36s40-12 60-36" fill="none" stroke="#9ca3af" stroke-width="7"/><circle cx="400" cy="412" r="8" fill="#9ca3af"/>';
    } else if (normalized.includes('watch')) {
      accessory = '<rect x="480" y="670" width="48" height="28" rx="10" fill="none" stroke="#9ca3af" stroke-width="6"/>';
    } else if (normalized.includes('hat')) {
      accessory = `<path d="M294 170h212v34H294z" fill="${clothingFill}"/><path d="M320 132h160v44H320z" fill="${hairFill2}"/>`;
    } else if (normalized.includes('scarf')) {
      accessory = `<path d="M334 366h132v56H334z" fill="${hairFill2}"/><rect x="334" y="408" width="34" height="114" rx="12" fill="${clothingFill}"/>`;
    } else {
      accessory = '';
    }
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="60%" stop-color="${bg2}"/>
      <stop offset="100%" stop-color="${bg3}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <circle cx="400" cy="315" r="${wave}" fill="${bg2}" opacity="0.28"/>
  ${hair}
  <circle cx="400" cy="275" r="115" fill="#ffffff" opacity="0.8"/>
  ${torso}
  ${clothing}
  ${accessory}
  <circle cx="355" cy="${eye}" r="5.5" fill="#9ca3af"/>
  <circle cx="445" cy="${eye}" r="5.5" fill="#9ca3af"/>
  <rect x="356" y="232" width="88" height="6" rx="3" fill="#9ca3af" opacity="0.65"/>
  <rect x="318" y="744" width="164" height="12" rx="6" fill="#9ca3af" opacity="0.4"/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function accessoryObjectDataUri(accessory: string, isDark = false) {
  // Colour tokens that adapt to theme
  const c1 = isDark ? '#6b7280' : '#9ca3af'; // lighter strokes / fills
  const c2 = isDark ? '#4b5563' : '#6b7280'; // mid-tone strokes / fills
  const c3 = isDark ? '#1f2937' : '#374151'; // dark fills (sunglasses lenses)
  const bgStop1 = isDark ? '#1e293b' : '#f8fafc';
  const bgStop2 = isDark ? '#334155' : '#e5e7eb';
  const bgStop3 = isDark ? '#475569' : '#d1d5db';
  const watchBand = isDark ? '#374151' : '#d1d5db';
  const watchFace = isDark ? '#1f2937' : '#e5e7eb';

  let shape = '';
  if (accessory === 'Glasses') {
    shape = `<rect x="250" y="430" width="130" height="90" rx="28" fill="none" stroke="${c2}" stroke-width="18"/><rect x="420" y="430" width="130" height="90" rx="28" fill="none" stroke="${c2}" stroke-width="18"/><line x1="380" y1="470" x2="420" y2="470" stroke="${c2}" stroke-width="18"/>`;
  } else if (accessory === 'Sunglasses') {
    shape = `<rect x="250" y="430" width="130" height="90" rx="28" fill="${c3}"/><rect x="420" y="430" width="130" height="90" rx="28" fill="${c3}"/><line x1="380" y1="470" x2="420" y2="470" stroke="${c2}" stroke-width="18"/>`;
  } else if (accessory === 'Earrings') {
    shape = `<circle cx="315" cy="470" r="48" fill="none" stroke="${c2}" stroke-width="16"/><circle cx="485" cy="470" r="48" fill="none" stroke="${c2}" stroke-width="16"/>`;
  } else if (accessory === 'Necklace') {
    shape = `<path d="M240 430c50 118 270 118 320 0" fill="none" stroke="${c2}" stroke-width="18"/><circle cx="400" cy="560" r="26" fill="${c1}"/>`;
  } else if (accessory === 'Watch') {
    shape = `<rect x="340" y="360" width="120" height="300" rx="28" fill="${watchBand}"/><rect x="322" y="440" width="156" height="140" rx="32" fill="${c2}"/><circle cx="400" cy="510" r="40" fill="${watchFace}"/><line x1="400" y1="510" x2="400" y2="482" stroke="${c2}" stroke-width="8"/><line x1="400" y1="510" x2="428" y2="510" stroke="${c2}" stroke-width="8"/>`;
  } else if (accessory === 'Hat') {
    shape = `<path d="M210 520h380v46H210z" fill="${c2}"/><path d="M260 380h280v146H260z" fill="${c1}"/>`;
  } else if (accessory === 'Scarf') {
    shape = `<path d="M250 380h300v140H250z" fill="${c1}"/><rect x="260" y="500" width="80" height="200" rx="18" fill="${c2}"/><rect x="460" y="500" width="80" height="200" rx="18" fill="${c2}"/>`;
  } else {
    shape = '';
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgStop1}"/>
      <stop offset="60%" stop-color="${bgStop2}"/>
      <stop offset="100%" stop-color="${bgStop3}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <rect x="64" y="64" width="672" height="872" rx="42" fill="#ffffff" opacity="0.55"/>
  ${shape}
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function optionHumanPhotoUri(key: string) {
  const local = (suffix: string) => `/img/Gemini_Generated_Image_h670yrh670yrh670${suffix}.png`;

  const genderMap: Record<string, string> = {
    male: local(""),
    female: local("-3"),
    non_binary: local("-2"),
  };

  const hairStyleMap: Record<string, string> = {
    "Short Straight": local("-4"),
    "Short Curly": local("-5"),
    "Medium Straight": local("-6"),
    "Long Straight": local("-7"),
    "Medium Wavy": local("-8"),
    "Long Curly": local("-9"),
    "Buzz Cut": local("-10"),
    Bob: local("-11"),
    Ponytail: local("-12"),
    Braids: local("-13"),
    Afro: local("-14"),
    Bald: local("-15"),
  };

  const bodyTypeMap: Record<string, string> = {
    slim: local("-16"),
    average: local("-17"),
    athletic: local("-18"),
    curvy: local("-19"),
    plus_size: local("-21"),
  };

  const clothingMap: Record<string, string> = {
    Casual: local("-20"),
    "Business Casual": local("-23"),
    Streetwear: local("-24"),
    Sporty: local("-25"),
    Elegant: local("-26"),
    Bohemian: local("-27"),
    Minimalist: local("-28"),
  };

  const accessoryMap: Record<string, string> = {
    None: optionImageDataUri("accessory-none"),
    Glasses: local("-29"),
    Sunglasses: local("-30"),
    Earrings: local("-31"),
    Necklace: local("-32"),
    Watch: local("-33"),
    Hat: local("-34"),
    Scarf: local("-32"),
  };

  if (key.startsWith("gender-")) return genderMap[key.slice(7)] ?? optionImageDataUri(key);
  if (key.startsWith("hair-style-")) return hairStyleMap[key.slice(11)] ?? optionImageDataUri(key);
  if (key.startsWith("body-type-")) return bodyTypeMap[key.slice(10)] ?? optionImageDataUri(key);
  if (key.startsWith("clothing-")) return clothingMap[key.slice(9)] ?? optionImageDataUri(key);
  if (key.startsWith("accessory-")) return accessoryMap[key.slice(10)] ?? optionImageDataUri(key);
  return optionImageDataUri(key);
}

// Ethnicity placeholder styles and local reference photos
const ethnicityPlaceholderStyle: Record<string, React.CSSProperties> = {
  'White / Caucasian':   { background: 'linear-gradient(135deg,#fde8d8 0%,#f5c6a0 100%)' },
  'Black / African':     { background: 'linear-gradient(135deg,#3b1f0a 0%,#1c0f05 100%)' },
  'East Asian':          { background: 'linear-gradient(135deg,#fef3e2 0%,#f5d9a8 100%)' },
  'South Asian':         { background: 'linear-gradient(135deg,#c68642 0%,#7d4c1e 100%)' },
  'Southeast Asian':     { background: 'linear-gradient(135deg,#e0ac69 0%,#a07040 100%)' },
  'Latino / Hispanic':   { background: 'linear-gradient(135deg,#d4956a 0%,#8b5e3c 100%)' },
  'Middle Eastern':      { background: 'linear-gradient(135deg,#c8a97a 0%,#8b6b42 100%)' },
  'Mixed / Multiracial': { background: 'linear-gradient(135deg,#d4a76a 0%,#9b7040 100%)' },
};

const ethnicityImageSrc: Record<string, string> = {
  'White / Caucasian':   '/img/ethnicity-white-caucasian.jpg',
  'Black / African':     '/img/ethnicity-black-african.jpg',
  'East Asian':          '/img/ethnicity-east-asian.jpg',
  'South Asian':         '/img/ethnicity-south-asian.jpg',
  'Southeast Asian':     '/img/ethnicity-southeast-asian.jpg',
  'Latino / Hispanic':   '/img/ethnicity-latino-hispanic.jpg',
  'Middle Eastern':      '/img/ethnicity-middle-eastern.jpg',
  'Mixed / Multiracial': '/img/ethnicity-mixed-multiracial.jpg',
};

// Color-tinted placeholder gradients for hair/eye options.
// Swap the placeholder <div> for <Image fill .../> per option when photos are ready.
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

const genderPlaceholderStyle: Record<string, React.CSSProperties> =
  Object.fromEntries(personaGenders.map((value) => [value, neutralCardStyle(`gender-${value}`)]));

const hairStylePlaceholderStyle: Record<string, React.CSSProperties> =
  Object.fromEntries(hairStyles.map((value) => [value, neutralCardStyle(`hair-style-${value}`)]));

const bodyTypePlaceholderStyle: Record<string, React.CSSProperties> =
  Object.fromEntries(personaBodyTypes.map((value) => [value, neutralCardStyle(`body-type-${value}`)]));

const clothingPlaceholderStyle: Record<string, React.CSSProperties> =
  Object.fromEntries(clothingStyles.map((value) => [value, neutralCardStyle(`clothing-${value}`)]));

const accessoriesPlaceholderStyle: Record<string, React.CSSProperties> =
  Object.fromEntries(accessoryOptions.map((value) => [value, neutralCardStyle(`accessory-${value}`)]));

const genderImageSrc: Record<string, string> =
  Object.fromEntries(personaGenders.map((value) => [value, optionHumanPhotoUri(`gender-${value}`)]));

const hairStyleImageSrc: Record<string, string> =
  Object.fromEntries(hairStyles.map((value) => [value, optionHumanPhotoUri(`hair-style-${value}`)]));

const bodyTypeImageSrc: Record<string, string> =
  Object.fromEntries(personaBodyTypes.map((value) => [value, optionHumanPhotoUri(`body-type-${value}`)]));

const clothingImageSrc: Record<string, string> =
  Object.fromEntries(clothingStyles.map((value) => [value, optionHumanPhotoUri(`clothing-${value}`)]));

const accessoriesImageSrc: Record<string, string> =
  Object.fromEntries(accessoryOptions.map((value) => [value, optionHumanPhotoUri(`accessory-${value}`)]));

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
        <span className="flex-shrink-0 text-primary">{icon}</span>
        <span className="flex-1 text-left text-sm font-semibold text-foreground">
          {label}
          {count !== undefined && (
            <span className="ml-1.5 font-normal text-muted-foreground">· {count}</span>
          )}
        </span>
        {open
          ? <ChevronUp className="size-4 text-muted-foreground" />
          : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="rounded-xl border border-border bg-muted/50 p-3">
          {children}
        </div>
      )}
    </div>
  );
}

/** Compact thumbnail option card with label + primary-colour ring when selected */
function ImageCard({
  label,
  selected,
  onClick,
  imageSrc,
  placeholderStyle,
  swatch = false,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  imageSrc?: string;
  placeholderStyle?: React.CSSProperties;
  swatch?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1',
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-lg transition-all duration-150',
          swatch ? 'h-10 w-10' : 'h-20 w-16',
          selected
            ? 'ring-2 ring-primary ring-offset-1 ring-offset-background'
            : 'ring-1 ring-border hover:ring-primary/40',
        )}
      >
        <div className="absolute inset-0 bg-muted" style={placeholderStyle} />
        {imageSrc && (
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        {selected && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
            <div className="flex size-5 flex-shrink-0 items-center justify-center rounded-full bg-primary">
              <Check className="size-3 text-primary-foreground" strokeWidth={3} />
            </div>
          </div>
        )}
      </div>
      <span className={cn(
        'max-w-[4.5rem] truncate text-center text-[11px] leading-tight',
        selected ? 'font-semibold text-primary' : 'text-muted-foreground',
      )}>
        {label}
      </span>
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
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

const PERSONA_STEPS = [
  { label: "Analyzing your description",  icon: <Cpu className="w-3 h-3" /> },
  { label: "Building visual scene",       icon: <FlaskConical className="w-3 h-3" /> },
  { label: "Generating portraits",        icon: <ImageIcon className="w-3 h-3" /> },
];

// ── Main component ──────────────────────────────────────────────────────────

interface PersonaBuilderInlineProps {
  onSaved: (personaId: string) => void;
  onCancel?: () => void;
}

export function PersonaBuilderInline({ onSaved, onCancel }: PersonaBuilderInlineProps) {
  const store = usePersonaBuilderStore();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const [createMode, setCreateMode] = useState<'quick' | 'custom'>('quick');
  const [quickDescription, setQuickDescription] = useState('');
  const [isGeneratingQuick, setIsGeneratingQuick] = useState(false);
  const [regenCount, setRegenCount] = useState<number>(0);
  const [generatingMessage, setGeneratingMessage] = useState(0);
  const [generatingElapsed, setGeneratingElapsed] = useState(0);
  const [loaderProgress, setLoaderProgress] = useState(0);
  const [loaderStep, setLoaderStep] = useState(-1);
  const progressSimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Theme detection ────────────────────────────────────────────────────────
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Progress simulation helpers ────────────────────────────────────────────
  function startSim(fromPct: number, toPct: number, durationMs: number, onDone?: () => void) {
    if (progressSimRef.current) clearInterval(progressSimRef.current);
    const start = Date.now();
    progressSimRef.current = setInterval(() => {
      const t = Math.min((Date.now() - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 2);
      setLoaderProgress(Math.round(fromPct + (toPct - fromPct) * eased));
      if (t >= 1) {
        clearInterval(progressSimRef.current!);
        progressSimRef.current = null;
        onDone?.();
      }
    }, 80);
  }

  function stopSim() {
    if (progressSimRef.current) {
      clearInterval(progressSimRef.current);
      progressSimRef.current = null;
    }
  }

  // Clean up interval on unmount
  useEffect(() => () => stopSim(), []);


  // ── Load regen_count on mount when resuming an existing persona ────────────
  useEffect(() => {
    if (!store.personaId || profile?.plan !== 'free') return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from('personas')
      .select('regen_count')
      .eq('id', store.personaId)
      .single()
      .then(({ data }: { data: { regen_count: number } | null }) => {
        if (!cancelled && data?.regen_count != null) setRegenCount(data.regen_count);
      });
    return () => { cancelled = true; };
  }, [store.personaId, profile?.plan]);

  // ── Generating message rotation ────────────────────────────────────────────
  const GENERATING_MESSAGES = [
    "Designing your AI persona...",
    "Rendering your portrait...",
    "Crafting your look...",
    "Almost there...",
    "Adding final touches...",
  ];

  useEffect(() => {
    if (!isGeneratingQuick && !store.isGenerating) {
      setGeneratingMessage(0);
      setGeneratingElapsed(0);
      return;
    }
    const msgInterval = setInterval(() => setGeneratingMessage(m => (m + 1) % GENERATING_MESSAGES.length), 3000);
    const timeInterval = setInterval(() => setGeneratingElapsed(s => s + 1), 1000);
    return () => { clearInterval(msgInterval); clearInterval(timeInterval); };
  }, [isGeneratingQuick, store.isGenerating]);


  // ── Preload all static persona option images on mount ──────────────────────
  useEffect(() => {
    const allSrcs = [
      ...Object.values(ethnicityImageSrc),
      ...Object.values(genderImageSrc),
      ...Object.values(hairStyleImageSrc),
      ...Object.values(bodyTypeImageSrc),
      ...Object.values(clothingImageSrc),
      ...Object.values(accessoriesImageSrc),
    ].filter((src) => !src.startsWith('data:'));

    const imgs = [...new Set(allSrcs)].map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
    // Keep reference to prevent GC while loading
    return () => { imgs.length = 0; };
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  // ── Dark-mode aware placeholder style maps ─────────────────────────────────
  const genderPlaceholderStyleDynamic: Record<string, React.CSSProperties> =
    Object.fromEntries(personaGenders.map((value) => [value, neutralCardStyle(`gender-${value}`, isDark)]));

  const hairStylePlaceholderStyleDynamic: Record<string, React.CSSProperties> =
    Object.fromEntries(hairStyles.map((value) => [value, neutralCardStyle(`hair-style-${value}`, isDark)]));

  const bodyTypePlaceholderStyleDynamic: Record<string, React.CSSProperties> =
    Object.fromEntries(personaBodyTypes.map((value) => [value, neutralCardStyle(`body-type-${value}`, isDark)]));

  const clothingPlaceholderStyleDynamic: Record<string, React.CSSProperties> =
    Object.fromEntries(clothingStyles.map((value) => [value, neutralCardStyle(`clothing-${value}`, isDark)]));

  const accessoriesPlaceholderStyleDynamic: Record<string, React.CSSProperties> =
    Object.fromEntries(accessoryOptions.map((value) => [value, neutralCardStyle(`accessory-${value}`, isDark)]));


  async function handleQuickCreate() {
    if (!store.name.trim() || !quickDescription.trim()) return;
    setIsGeneratingQuick(true);

    // Step 0 → 1: OpenRouter calls (description→attrs + scene prompt)
    setLoaderProgress(0);
    setLoaderStep(0);
    startSim(0, 15, 20_000, () => {
      setLoaderStep(1);
      startSim(15, 30, 15_000); // no onDone — phase 2 will snap to step 2
    });

    try {
      // ── Phase 1: init ──────────────────────────────────────────────────────
      // Create persona record + resolve attributes (OpenRouter only, ~15s).
      // Returns persona_id + attributes (with scene_prompt) immediately.
      const initResult = await callEdge<{
        data: { id: string; attributes: Record<string, unknown> };
      }>('generate-persona', {
        body: { name: store.name.trim(), description: quickDescription.trim(), image_count: 0 },
        timeoutMs: 60_000,
      });

      const { id: personaId, attributes } = initResult.data;
      store.setPersonaId(personaId);

      // ── Phase 2: parallel image generation ────────────────────────────────
      // Both edge function calls run simultaneously, each generating 1 image
      // in its own worker (separate memory budget → no WORKER_LIMIT).
      stopSim();
      setLoaderStep(2);
      startSim(30, 95, 55_000); // no onDone — Gemini responses will interrupt

      const imageCallBody = { persona_id: personaId, name: store.name.trim(), attributes, image_count: 1 };
      const [res1, res2] = await Promise.allSettled([
        callEdge<{ data: { generated_image_urls: string[] } }>('generate-persona', {
          body: imageCallBody,
          timeoutMs: 180_000,
        }),
        callEdge<{ data: { generated_image_urls: string[] } }>('generate-persona', {
          body: imageCallBody,
          timeoutMs: 180_000,
        }),
      ]);

      // Collect URLs from whichever calls succeeded
      const urls: string[] = [];
      if (res1.status === 'fulfilled') urls.push(...(res1.value.data.generated_image_urls ?? []));
      if (res2.status === 'fulfilled') urls.push(...(res2.value.data.generated_image_urls ?? []));

      if (urls.length === 0) {
        const rej = res1.status === 'rejected' ? res1 : (res2.status === 'rejected' ? res2 : null);
        const err = rej && 'reason' in rej ? rej.reason : new Error('Both portrait generations failed');
        throw err instanceof Error ? err : new Error('Both portrait generations failed');
      }

      store.setGeneratedImages(urls);
      queryClient.invalidateQueries({ queryKey: ['personas'] });

      stopSim();
      setLoaderProgress(100);
      setTimeout(() => { setLoaderStep(-1); setLoaderProgress(0); }, 800);

      toast.success('Persona generated! Select your preferred portrait.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate persona';
      toast.error(msg);
      stopSim();
      setLoaderStep(-1);
      setLoaderProgress(0);
    } finally {
      setIsGeneratingQuick(false);
    }
  }

  async function handleGenerate() {
    if (!store.name.trim()) return;
    store.setIsGenerating(true);
    setImageLoadErrors(new Set());
    toast.info('Generating persona images…');

    try {
      const attributes = {
        gender: store.gender,
        ethnicity: store.ethnicity,
        skin_tone: store.skinTone, // legacy fallback kept for compat
        age: store.ageRange,
        hair_color: store.hairColor,
        hair_style: store.hairStyle,
        eye_color: store.eyeColor,
        body_type: store.bodyType,
        clothing_style: store.clothingStyle,
        accessories: store.accessories,
      };

      const result = await callEdge<{
        data: { id: string; generated_images: string[]; generated_image_urls: string[]; regen_count?: number };
      }>('generate-persona', {
        body: {
          name: store.name,
          attributes,
          ...(store.personaId ? { persona_id: store.personaId } : {}),
        },
        timeoutMs: 180_000,
      });

      const displayUrls = result.data.generated_image_urls ?? result.data.generated_images;
      store.setPersonaId(result.data.id);
      store.setGeneratedImages(displayUrls);
      if (result.data.regen_count != null) setRegenCount(result.data.regen_count);
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
      // Invalidate personas cache so the onboarding checklist and other
      // consumers immediately see the newly-saved persona with its image.
      queryClient.invalidateQueries({ queryKey: ["personas"] });
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

      <div className={cn(
        "grid gap-6",
        store.generatedImages.length > 0
          ? "lg:grid-cols-2"
          : "lg:grid-cols-[1fr_300px]",
      )}>

        {/* ── Left: Sims-style criteria builder ─────────────────────── */}
        <fieldset disabled={store.isGenerating || store.isSaving || isGeneratingQuick} className="min-w-0">
          <div className={cn(
            'flex flex-col gap-5 transition-opacity',
            (store.isGenerating || store.isSaving || isGeneratingQuick) && 'pointer-events-none opacity-50',
          )}>

            {/* Persona Name (always visible) */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Persona Name
              </Label>
              <Input
                placeholder="e.g. Sophie, Marcus"
                value={store.name}
                onChange={(e) => store.setField('name', e.target.value)}
              />
            </div>

            {/* Quick / Custom mode selector */}
            <div className="flex gap-1.5 rounded-xl border border-border bg-muted/50 p-1 mb-4">
              <button type="button" onClick={() => setCreateMode('quick')} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all', createMode === 'quick' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <Wand2 className="size-3.5" />
                Quick
              </button>
              <button type="button" onClick={() => setCreateMode('custom')} className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all', createMode === 'custom' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <Palette className="size-3.5" />
                Custom
              </button>
            </div>

            {/* Quick Create mode */}
            {createMode === 'quick' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="inline-quick-description" className="text-xs">Describe your persona</Label>
                  <Textarea
                    id="inline-quick-description"
                    placeholder="e.g. A 28-year-old Black woman with natural hair, casual sporty style, friendly energy"
                    value={quickDescription}
                    onChange={(e) => setQuickDescription(e.target.value)}
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground">The AI will generate images from your description.</p>
                </div>
                <Button
                  onClick={handleQuickCreate}
                  disabled={!store.name.trim() || !quickDescription.trim() || isGeneratingQuick}
                  className="w-full gap-2"
                >
                  {isGeneratingQuick ? (
                    <><Loader2 className="size-4 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="size-4" />Generate from description</>
                  )}
                </Button>
              </div>
            )}

            {/* Custom mode: the full visual builder */}
            {createMode === 'custom' && (<>

            {/* Gender */}
            <Section icon={<User className="size-4" />} label="Gender" count={1}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {personaGenders.map((g) => (
                  <ImageCard
                    key={g}
                    label={genderLabels[g]}
                    selected={store.gender === g}
                    onClick={() => store.setField('gender', g)}
                    imageSrc={genderImageSrc[g]}
                    placeholderStyle={genderPlaceholderStyleDynamic[g]}
                  />
                ))}
              </div>
            </Section>

            {/* Ethnicity */}
            <Section icon={<Palette className="size-4" />} label="Ethnicity" count={1}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {ethnicities.map((eth) => (
                  <ImageCard
                    key={eth}
                    label={eth}
                    selected={store.ethnicity === eth}
                    onClick={() => store.setField('ethnicity', eth)}
                    imageSrc={ethnicityImageSrc[eth]}
                    placeholderStyle={ethnicityPlaceholderStyle[eth]}
                  />
                ))}
              </div>
            </Section>

            {/* Age Range */}
            <Section icon={<Clock className="size-4" />} label="Age Range" count={1}>
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
            <Section icon={<Palette className="size-4" />} label="Hair Color" count={1}>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {hairColors.map((color) => (
                  <ImageCard
                    key={color}
                    label={color}
                    selected={store.hairColor === color}
                    onClick={() => store.setField('hairColor', color)}
                    placeholderStyle={hairPlaceholderStyle[color]}
                    swatch
                  />
                ))}
              </div>
            </Section>

            {/* Hair Style */}
            <Section icon={<User className="size-4" />} label="Hair Style" count={1}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {hairStyles.map((style) => (
                  <ImageCard
                    key={style}
                    label={style}
                    selected={store.hairStyle === style}
                    onClick={() => store.setField('hairStyle', style)}
                    imageSrc={hairStyleImageSrc[style]}
                    placeholderStyle={hairStylePlaceholderStyleDynamic[style]}
                  />
                ))}
              </div>
            </Section>

            {/* Eye Color */}
            <Section icon={<Eye className="size-4" />} label="Eye Color" count={1}>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {eyeColors.map((color) => (
                  <ImageCard
                    key={color}
                    label={color}
                    selected={store.eyeColor === color}
                    onClick={() => store.setField('eyeColor', color)}
                    placeholderStyle={eyePlaceholderStyle[color]}
                    swatch
                  />
                ))}
              </div>
            </Section>

            {/* Body Type */}
            <Section icon={<User className="size-4" />} label="Body Type" count={1}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {personaBodyTypes.map((type) => (
                  <ImageCard
                    key={type}
                    label={bodyTypeLabels[type]}
                    selected={store.bodyType === type}
                    onClick={() => store.setField('bodyType', type)}
                    imageSrc={bodyTypeImageSrc[type]}
                    placeholderStyle={bodyTypePlaceholderStyleDynamic[type]}
                  />
                ))}
              </div>
            </Section>

            {/* Clothing Style */}
            <Section icon={<Shirt className="size-4" />} label="Clothing Style" count={1}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {clothingStyles.map((style) => (
                  <ImageCard
                    key={style}
                    label={style}
                    selected={store.clothingStyle === style}
                    onClick={() => store.setField('clothingStyle', style)}
                    imageSrc={clothingImageSrc[style]}
                    placeholderStyle={clothingPlaceholderStyleDynamic[style]}
                  />
                ))}
              </div>
            </Section>

            {/* Accessories, multi-select */}
            <Section
              icon={<Watch className="size-4" />}
              label="Accessories"
              count={store.accessories.length}
            >
              <p className="mb-2 text-xs text-muted-foreground">Select up to 5</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {accessoryOptions.map((acc) => {
                  const isSelected = store.accessories.includes(acc);
                  return (
                    <ImageCard
                      key={acc}
                      label={acc}
                      selected={isSelected}
                      onClick={() => store.toggleAccessory(acc)}
                      imageSrc={accessoriesImageSrc[acc]}
                      placeholderStyle={accessoriesPlaceholderStyleDynamic[acc]}
                    />
                  );
                })}
              </div>
            </Section>

            </>) /* end createMode === 'custom' */}

          </div>
        </fieldset>

        {/* ── Right: preview + generate ──────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="sticky top-6">

            {/* Generating loader (Quick Create) */}
            {isGeneratingQuick && store.generatedImages.length === 0 && (
              <NanoBananaLoader
                title="Creating Your Persona"
                subtitle="Generating unique portraits — usually 60–90 seconds"
                steps={PERSONA_STEPS}
                currentStep={loaderStep}
                progress={loaderProgress}
                className="min-h-[400px]"
              />
            )}

            {/* Generating skeleton (Visual Builder - custom mode) */}
            {store.isGenerating && !isGeneratingQuick && store.generatedImages.length === 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">
                    {GENERATING_MESSAGES[generatingMessage]}
                  </p>
                  <span className="text-xs text-muted-foreground">{generatingElapsed}s</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border-2 border-transparent bg-muted animate-pulse">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                      <User className="size-8" />
                      <span className="text-xs">Portrait 1</span>
                    </div>
                  </div>
                  <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border-2 border-transparent bg-muted animate-pulse">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
                      <User className="size-8" />
                      <span className="text-xs">Portrait 2</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Expected time: ~35-45 seconds per portrait
                </p>
              </div>
            )}

            {/* Attribute summary (before generating) */}
            {store.generatedImages.length === 0 && !store.isGenerating && !isGeneratingQuick && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Persona Preview</p>
                <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-6 text-primary" />
                </div>
                <Separator className="mb-3" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {[
                    { label: 'Name',      value: store.name || 'Enter a name...' },
                    { label: 'Gender',    value: genderLabels[store.gender] },
                    { label: 'Age',       value: ageRangeLabels[store.ageRange] },
                    { label: 'Ethnicity', value: store.ethnicity },
                    { label: 'Hair',      value: `${store.hairColor}, ${store.hairStyle}` },
                    { label: 'Eyes',      value: store.eyeColor },
                    { label: 'Body',      value: bodyTypeLabels[store.bodyType] },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="truncate font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
                {store.accessories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
                    {store.accessories.map((acc) => (
                      <Badge key={acc} variant="secondary" className="text-xs">
                        {acc}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Generated image picker */}
            {store.generatedImages.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-semibold text-foreground">Choose Your Persona</p>
                <div className="grid grid-cols-2 gap-3">
                  {store.generatedImages.map((url, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => store.selectImage(index)}
                      className={cn(
                        'relative aspect-[3/4] overflow-hidden rounded-xl transition-all',
                        store.selectedImageIndex === index
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'ring-1 ring-border hover:ring-primary/40',
                      )}
                    >
                      {imageLoadErrors.has(index) ? (
                        <div className="flex size-full items-center justify-center bg-muted">
                          <ImageIcon className="size-8 text-muted-foreground" />
                        </div>
                      ) : (
                        <Image
                          src={url}
                          alt={`Persona option ${index + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, 280px"
                          onError={() =>
                            setImageLoadErrors((prev) => new Set(prev).add(index))
                          }
                        />
                      )}
                      {store.selectedImageIndex === index && (
                        <div className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary">
                          <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
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
                  className="w-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
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
                    className="w-full"
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
                  {profile?.plan === 'free' && regenCount > 0 && (
                    <p className="text-center text-xs text-muted-foreground">{regenCount} of 4 regenerations used</p>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <Button
                            onClick={handleGenerate}
                            variant="outline"
                            disabled={store.isGenerating || store.isSaving || (profile?.plan === 'free' && regenCount >= 4)}
                            className="w-full"
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
                        </span>
                      </TooltipTrigger>
                      {profile?.plan === 'free' && regenCount >= 4 && (
                        <TooltipContent>
                          <p>Upgrade to regenerate more images</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
