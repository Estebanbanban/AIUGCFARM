"use client";

import { motion } from "framer-motion";
import { fadeInUp, slideInLeft, slideInRight } from "@/lib/animations";
import {
  Check,
  Link,
  ShoppingBag,
  User,
  Shuffle,
  PlayCircle,
  MonitorPlay,
  Grid3X3,
} from "lucide-react";

function FeatureMockUrl() {
  const products = [
    { name: "Hydra Serum", price: "$45", gradient: "from-rose-500/20 to-rose-700/20" },
    { name: "Cloud Runner", price: "$129", gradient: "from-zinc-400/20 to-zinc-600/20" },
    { name: "Vital Blend", price: "$39", gradient: "from-green-500/20 to-green-700/20" },
    { name: "Luna Ring", price: "$89", gradient: "from-amber-500/20 to-amber-700/20" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-zinc-900/80 p-6 space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-zinc-800/80 px-3 py-2 text-sm">
        <Link className="size-4 text-primary/60" />
        <span className="text-muted-foreground">
          https://mystore.com/products
        </span>
        <div className="ml-auto flex items-center gap-1">
          <div className="size-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] text-primary">Importing...</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
            <div
              key={product.name}
              className="rounded-lg border border-border bg-zinc-800/60 p-3 space-y-2"
            >
              <div className={`aspect-square rounded-md bg-gradient-to-br ${product.gradient} flex items-center justify-center`}>
                <ShoppingBag className="size-6 text-white/40" />
              </div>
              <div>
                <p className="text-xs font-medium text-foreground truncate">{product.name}</p>
                <p className="text-[10px] text-muted-foreground">{product.price}</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function FeatureMockPersona() {
  return (
    <div className="rounded-2xl border border-border bg-zinc-900/80 p-6 space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20">
          <User className="size-6 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm text-foreground">AI Spokesperson</p>
          <p className="text-xs text-muted-foreground">
            9 configurable attributes
          </p>
        </div>
      </div>
      {[
        { name: "Tone", value: "Friendly & Energetic", width: "65%" },
        { name: "Age Range", value: "25-34", width: "45%" },
        { name: "Style", value: "Professional", width: "80%" },
        { name: "Background", value: "Studio", width: "55%" },
      ].map((attr) => (
        <div key={attr.name} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{attr.name}</span>
            <span className="text-[10px] text-foreground/60">{attr.value}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary/40"
              style={{ width: attr.width }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureMockMixer() {
  return (
    <div className="rounded-2xl border border-border bg-zinc-900/80 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shuffle className="size-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Segment Mixer</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["Hook", "Body", "CTA"].map((segment) => (
          <div key={segment} className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-center">
              {segment}
            </p>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`rounded-lg border p-2 text-center text-[11px] transition-colors ${
                  n === 1
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-zinc-800/60 text-muted-foreground"
                }`}
              >
                {segment} {n}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-3 pt-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="font-mono text-foreground">3</span> x
          <span className="font-mono text-foreground">3</span> x
          <span className="font-mono text-foreground">3</span> =
        </div>
        <span className="font-semibold text-primary text-sm">27 combos</span>
      </div>
    </div>
  );
}

function FeatureMockPlatforms() {
  return (
    <div className="rounded-2xl border border-border bg-zinc-900/80 p-6">
      <div className="flex items-center justify-center gap-8 mb-6">
        {[
          { name: "TikTok", icon: PlayCircle },
          { name: "Meta", icon: MonitorPlay },
          { name: "Shorts", icon: PlayCircle },
        ].map((p) => (
          <div key={p.name} className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <p.icon className="size-5 text-primary" />
            </div>
            <span className="text-xs font-medium text-foreground">{p.name}</span>
          </div>
        ))}
      </div>
      {/* Format preview grid */}
      <div className="flex items-end justify-center gap-3">
        {/* 9:16 vertical */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-[60px] h-[107px] rounded-lg border border-primary/30 bg-gradient-to-b from-primary/10 to-primary/5 flex items-center justify-center">
            <div className="text-center">
              <PlayCircle className="size-5 text-primary/50 mx-auto mb-0.5" />
              <p className="text-[7px] text-primary/60 font-medium">9:16</p>
            </div>
          </div>
          <span className="text-[9px] text-primary font-medium">Vertical</span>
        </div>
        {/* 1:1 square */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-[80px] h-[80px] rounded-lg border border-border bg-zinc-800/60 flex items-center justify-center">
            <div className="text-center">
              <Grid3X3 className="size-5 text-white/30 mx-auto mb-0.5" />
              <p className="text-[7px] text-white/40 font-medium">1:1</p>
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground">Square</span>
        </div>
        {/* 16:9 horizontal */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-[107px] h-[60px] rounded-lg border border-border bg-zinc-800/60 flex items-center justify-center">
            <div className="text-center">
              <MonitorPlay className="size-5 text-white/30 mx-auto mb-0.5" />
              <p className="text-[7px] text-white/40 font-medium">16:9</p>
            </div>
          </div>
          <span className="text-[9px] text-muted-foreground">Landscape</span>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    title: "Import Your Entire Store in Seconds",
    description:
      "Paste a single URL and we pull every product — images, descriptions, prices. Works with Shopify, WooCommerce, or any public product page.",
    bullets: [
      "Auto-detect product data",
      "Bulk import entire catalogs",
      "Edit anytime in dashboard",
    ],
    mock: <FeatureMockUrl />,
    reversed: false,
  },
  {
    title: "Your Brand's AI Spokesperson",
    description:
      "Design a virtual presenter that matches your brand voice. Control tone, appearance, script style, and more across 9 attributes.",
    bullets: [
      "9 configurable persona attributes",
      "Consistent brand identity",
      "Multiple personas per brand",
    ],
    mock: <FeatureMockPersona />,
    reversed: true,
  },
  {
    title: "27 Video Combos from 9 Segments",
    description:
      "Each video is split into Hook, Body, and CTA segments. Mix and match to generate up to 27 unique variations from a single product.",
    bullets: [
      "3 hooks, 3 bodies, 3 CTAs",
      "A/B test at scale",
      "Download individual segments",
    ],
    mock: <FeatureMockMixer />,
    reversed: false,
  },
  {
    title: "Built for TikTok, Meta & YouTube Shorts",
    description:
      "Every video is optimized for social ad platforms. Vertical-first format, captions, and trends built in.",
    bullets: [
      "9:16 vertical-first output",
      "Platform-ready exports",
      "Trending hooks & formats",
    ],
    mock: <FeatureMockPlatforms />,
    reversed: true,
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {features.map((feature, i) => (
          <div
            key={i}
            className={`flex flex-col gap-12 md:gap-16 py-24 first:pt-0 last:pb-0 ${
              feature.reversed ? "md:flex-row-reverse" : "md:flex-row"
            } items-center`}
          >
            {/* Text */}
            <motion.div
              {...(feature.reversed ? slideInRight : slideInLeft)}
              whileInView={
                feature.reversed ? slideInRight.animate : slideInLeft.animate
              }
              viewport={{ once: true }}
              className="flex-1 space-y-6"
            >
              <h3 className="text-3xl md:text-4xl font-bold tracking-tight">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {feature.description}
              </p>
              <ul className="space-y-3">
                {feature.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex items-center gap-3 text-sm"
                  >
                    <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="size-3 text-primary" />
                    </div>
                    {bullet}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Mock visual */}
            <motion.div
              {...(feature.reversed ? slideInLeft : slideInRight)}
              whileInView={
                feature.reversed ? slideInLeft.animate : slideInRight.animate
              }
              viewport={{ once: true }}
              className="flex-1 w-full"
            >
              {feature.mock}
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}
