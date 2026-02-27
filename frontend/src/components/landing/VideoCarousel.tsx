"use client";

import { useState } from "react";

const reels = [
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    poster:
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    poster:
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    poster:
      "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    poster:
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    poster:
      "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    poster:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
    poster:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80",
  },
  {
    videoSrc:
      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    poster:
      "https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=900&q=80",
  },
];

function ReelCard({ reel }: { reel: (typeof reels)[number] }) {
  return (
    <div className="flex-shrink-0 px-2.5 md:px-3">
      <div className="relative w-[180px] sm:w-[210px] md:w-[240px] aspect-[9/16] overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#101010] shadow-[0_14px_26px_rgba(0,0,0,0.35)]">
        <video
          className="h-full w-full object-cover"
          poster={reel.poster}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
        >
          <source src={reel.videoSrc} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-black/28 to-transparent" />
      </div>
    </div>
  );
}

export function VideoCarousel() {
  const [paused, setPaused] = useState(false);
  const doubled = [...reels, ...reels];

  return (
    <section className="bg-black pb-20 pt-14 md:pb-28 md:pt-20">
      <div
        className="overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className="flex w-max"
          style={{
            animation: "ticker 42s linear infinite",
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {doubled.map((reel, i) => (
            <ReelCard key={`${reel.videoSrc}-${i}`} reel={reel} />
          ))}
        </div>
      </div>
    </section>
  );
}
