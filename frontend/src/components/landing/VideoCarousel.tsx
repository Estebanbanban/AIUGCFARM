"use client";

import { useState } from "react";
import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";

const phones = [
  { product: "Vitamin C Serum", price: "$34", category: "skincare", pov: "POV: I found the best skincare routine", gradient: "from-[#1a0a00] via-[#2d1500] to-[#1a0a00]" },
  { product: "Air Max Pulse", price: "$149", category: "sneakers", pov: "POV: these sneakers changed everything", gradient: "from-[#000d1a] via-[#001529] to-[#000d1a]" },
  { product: "Gold Chain Necklace", price: "$59", category: "jewelry", pov: "POV: found the perfect gift for myself", gradient: "from-[#0f0a00] via-[#1a1000] to-[#0f0a00]" },
  { product: "Wireless Earbuds", price: "$79", category: "tech", pov: "POV: best $79 I ever spent", gradient: "from-[#050514] via-[#0a0a1f] to-[#050514]" },
  { product: "Hydrating Face Cream", price: "$42", category: "beauty", pov: "POV: my skin has never looked better", gradient: "from-[#0d0014] via-[#180020] to-[#0d0014]" },
  { product: "Oversized Hoodie", price: "$65", category: "fashion", pov: "POV: the most comfortable hoodie ever", gradient: "from-[#0a0a0a] via-[#141414] to-[#0a0a0a]" },
  { product: "Whey Protein", price: "$49", category: "health", pov: "POV: finally found my perfect protein", gradient: "from-[#001a0a] via-[#002914] to-[#001a0a]" },
  { product: "Smart Watch Pro", price: "$199", category: "tech", pov: "POV: this watch is on another level", gradient: "from-[#0a0014] via-[#14001f] to-[#0a0014]" },
];

// Arc: center=0px, outward increases
const arcOffsets = [45, 25, 10, 0, 0, 10, 25, 45];
const arcRotations = [-3, -2, -1, 0, 0, 1, 2, 3];

function PhoneCard({ phone, arcOffset, arcRotation }: {
  phone: typeof phones[number];
  arcOffset: number;
  arcRotation: number;
}) {
  return (
    <div
      className="flex-shrink-0 px-[10px]"
      style={{ transform: `translateY(${arcOffset}px) rotate(${arcRotation}deg)` }}
    >
      <div className="relative w-[130px] md:w-[160px] transition-all duration-300 hover:scale-[1.08] hover:z-10 cursor-pointer group">
        {/* Phone shell */}
        <div className="w-full aspect-[9/16] rounded-[28px] border-2 border-[#2A2A2A] bg-[#0A0A0A] p-2 shadow-2xl group-hover:border-[#444] group-hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-all duration-300">
          {/* Screen */}
          <div className={`relative w-full h-full rounded-[20px] overflow-hidden bg-gradient-to-b ${phone.gradient}`}>

            {/* Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-black rounded-full z-20" />

            {/* POV text overlay top */}
            <div className="absolute top-7 left-0 right-8 px-3 z-10">
              <p className="text-white text-[9px] font-medium leading-tight drop-shadow-lg">
                {phone.pov}
              </p>
            </div>

            {/* Right side TikTok icons */}
            <div className="absolute right-2 bottom-16 flex flex-col items-center gap-3 z-10">
              <div className="flex flex-col items-center gap-0.5">
                <Heart className="size-4 text-white/80" strokeWidth={1.5} />
                <span className="text-[7px] text-white/60">24K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <MessageCircle className="size-4 text-white/80" strokeWidth={1.5} />
                <span className="text-[7px] text-white/60">1.2K</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Share2 className="size-4 text-white/80" strokeWidth={1.5} />
                <span className="text-[7px] text-white/60">Share</span>
              </div>
              <Bookmark className="size-4 text-white/70" strokeWidth={1.5} />
            </div>

            {/* Bottom product info overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-3 pt-8 z-10">
              {/* Orange progress bar */}
              <div className="w-full h-0.5 bg-white/10 rounded-full mb-2.5">
                <div className="w-[62%] h-full bg-primary rounded-full" />
              </div>
              <p className="text-white text-[10px] font-semibold leading-none">{phone.product}</p>
              <p className="text-white/60 text-[8px] mt-0.5">{phone.price}</p>
              <div className="mt-1.5 w-full rounded-lg bg-white/15 py-1 text-center text-[8px] font-medium text-white">
                Shop Now
              </div>
              {/* CineRads watermark */}
              <p className="text-[6px] text-white/20 mt-1">CineRads</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoCarousel() {
  const [paused, setPaused] = useState(false);
  const doubled = [...phones, ...phones];

  return (
    <section className="bg-black overflow-hidden pt-2 pb-12">
      {/* Ticker wrapper */}
      <div
        className="overflow-hidden"
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
          {doubled.map((phone, i) => (
            <PhoneCard
              key={i}
              phone={phone}
              arcOffset={arcOffsets[i % 8]}
              arcRotation={arcRotations[i % 8]}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-[#555] mt-10 tracking-wide px-4">
        Every video AI-generated. Every persona customizable. Every ad ready to run.
      </p>
    </section>
  );
}
