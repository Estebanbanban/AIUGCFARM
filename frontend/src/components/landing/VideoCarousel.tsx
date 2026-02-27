"use client";

import { useState } from "react";
import { Heart, MessageCircle, Share2, Music } from "lucide-react";

const products = [
  { name: "Vitamin C Serum", price: "$34", color: "from-amber-950 to-amber-900" },
  { name: "Cloud Runner Pro", price: "$129", color: "from-blue-950 to-blue-900" },
  { name: "Gold Necklace", price: "$59", color: "from-stone-900 to-stone-800" },
  { name: "Wireless Earbuds", price: "$79", color: "from-violet-950 to-violet-900" },
  { name: "Face Cream", price: "$42", color: "from-rose-950 to-rose-900" },
  { name: "Oversized Hoodie", price: "$65", color: "from-slate-900 to-slate-800" },
  { name: "Protein Powder", price: "$49", color: "from-green-950 to-green-900" },
  { name: "Smart Watch", price: "$199", color: "from-zinc-900 to-zinc-800" },
];

// Arc: center phones sit highest (0px down), edges dip down (36px)
const arcOffsets = [36, 20, 8, 0, 0, 8, 20, 36];

function PhoneCard({
  product,
  arcOffset,
}: {
  product: (typeof products)[number];
  arcOffset: number;
}) {
  return (
    // Outer: uniform slot width (160px phone + 20px padding = 180px/slot) for seamless ticker math
    <div
      className="flex-shrink-0 px-[10px]"
      style={{ transform: `translateY(${arcOffset}px)` }}
    >
      {/* Inner: hover scale isolated from arc transform */}
      <div className="relative w-[160px] transition-transform duration-300 hover:scale-105">
        <div className="aspect-[9/16] rounded-[2rem] border-[3px] border-neutral-700 shadow-2xl overflow-hidden relative bg-black">
          <div className={`absolute inset-0 bg-gradient-to-b ${product.color}`} />

          <div className="relative h-full flex flex-col justify-between p-3">
            {/* CineRads watermark top-left */}
            <div className="flex items-center gap-1.5">
              <div className="size-6 rounded-full bg-white/15 flex items-center justify-center">
                <span className="text-[8px] font-bold text-white">CR</span>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-white leading-none">CineRads</p>
                <p className="text-[7px] text-white/50 mt-0.5">Sponsored</p>
              </div>
            </div>

            {/* TikTok-style sidebar icons */}
            <div className="absolute right-2 bottom-[5.5rem] flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-0.5">
                <Heart className="size-4 text-white/80" />
                <span className="text-[8px] text-white/60">24K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <MessageCircle className="size-4 text-white/80" />
                <span className="text-[8px] text-white/60">1.2K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Share2 className="size-4 text-white/80" />
                <span className="text-[8px] text-white/60">Share</span>
              </div>
            </div>

            {/* Bottom: product info + CTA */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Music className="size-2.5 text-white/40" />
                <div className="h-1.5 w-16 rounded-full bg-white/10">
                  <div className="h-full w-2/5 rounded-full bg-white/25" />
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-white leading-tight">
                  {product.name}
                </p>
                <p className="text-[9px] text-white/60">{product.price}</p>
              </div>
              <div className="w-full rounded-lg bg-white/20 py-1.5 text-center text-[9px] font-medium text-white">
                Shop Now
              </div>
              {/* Home indicator bar */}
              <div className="flex justify-center pt-0.5">
                <div className="w-10 h-0.5 bg-white/30 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoCarousel() {
  const [paused, setPaused] = useState(false);
  // Duplicate phones for seamless infinite loop
  // 8 original + 8 duplicate = 16 total slots
  // -50% animation = exactly 8 slots = perfect loop
  const doubled = [...products, ...products];

  return (
    <section className="overflow-hidden pt-2 pb-10">
      {/* Ticker wrapper — hover pauses the whole carousel */}
      <div
        className="overflow-hidden cursor-pointer"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex w-max"
          style={{
            animation: "ticker 40s linear infinite",
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {doubled.map((product, i) => (
            <PhoneCard
              key={i}
              product={product}
              arcOffset={arcOffsets[i % 8]}
            />
          ))}
        </div>
      </div>

      {/* Caption below carousel */}
      <p className="text-center text-xs text-muted-foreground mt-12 tracking-wide px-4">
        Every video generated by AI. Every persona customizable. Every ad ready to run.
      </p>
    </section>
  );
}
