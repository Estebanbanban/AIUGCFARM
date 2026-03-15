"use client";

import { motion } from "framer-motion";
import { slideInLeft, slideInRight } from "@/lib/animations";
import { Check } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Shared grid pattern - rendered inside each SVG's own <defs>               */
/* -------------------------------------------------------------------------- */

function GridPattern({ id }: { id: string }) {
  return (
    <pattern id={id} width="30" height="30" patternUnits="userSpaceOnUse">
      <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
    </pattern>
  );
}

/* -------------------------------------------------------------------------- */
/*  1. Product Import                                                           */
/* -------------------------------------------------------------------------- */

function AnimationProductImport() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-zinc-950">
      <svg viewBox="0 0 600 420" className="w-full h-auto block">
        <defs>
          <GridPattern id="pi-grid" />
          <filter id="pi-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComponentTransfer in="blur" result="fadedBlur">
              <feFuncA type="linear" slope="0.6" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="fadedBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="pi-scan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
          {/* SVG clipPath for URL text reveal - replaces unreliable CSS clip-path:inset() on <g> */}
          <clipPath id="pi-url-clip">
            <rect x="146" y="70" height="44">
              <animate
                attributeName="width"
                values="0;0;226;226;226;0"
                keyTimes="0;0.05;0.18;0.90;0.97;1"
                dur="10s"
                repeatCount="indefinite"
              />
            </rect>
          </clipPath>
        </defs>
        <style>{`
          .pi-loop   { animation: pi-fade      10s ease-in-out                      infinite; }
          .pi-btn    { animation: pi-press     10s cubic-bezier(0.34,1.56,0.64,1)   infinite; transform-origin: 482.5px 92px; transform-box: fill-box; }
          .pi-scan   { animation: pi-scanline  10s cubic-bezier(0.65,0,0.35,1)      infinite; }
          .pi-skel   { animation: pi-skelFade  10s ease-in-out                      infinite; }
          .pi-r1     { animation: pi-rowUp     10s cubic-bezier(0.34,1.56,0.64,1)   infinite; animation-delay: 0s; }
          .pi-r2     { animation: pi-rowUp     10s cubic-bezier(0.34,1.56,0.64,1)   infinite; animation-delay: 0.15s; }
          .pi-r3     { animation: pi-rowUp     10s cubic-bezier(0.34,1.56,0.64,1)   infinite; animation-delay: 0.3s; }
          .pi-sum    { animation: pi-summary   10s cubic-bezier(0.34,1.56,0.64,1)   infinite; }
          .pi-border { animation: pi-bPulse    10s                                  infinite; }

          @keyframes pi-fade     { 0%,5%{opacity:0;transform:scale(0.98)} 10%,90%{opacity:1;transform:scale(1)} 95%,100%{opacity:0;transform:scale(0.98)} }
          @keyframes pi-press    { 0%,18%{transform:scale(1);filter:none} 19%{transform:scale(0.92);filter:brightness(1.2)} 22%,100%{transform:scale(1);filter:url(#pi-glow)} }
          @keyframes pi-scanline { 0%,23%{opacity:0;transform:translateY(0)} 24%{opacity:1;transform:translateY(0)} 40%,100%{opacity:0;transform:translateY(180px)} }
          @keyframes pi-skelFade { 0%,23%{opacity:0} 25%,38%{opacity:1} 40%,100%{opacity:0} }
          /* CRITICAL: animation-only class - no SVG transform attr on this element */
          @keyframes pi-rowUp    { 0%,42%{opacity:0;transform:translateY(20px)} 48%,95%{opacity:1;transform:translateY(0)} 100%{opacity:0} }
          @keyframes pi-summary  { 0%,58%{opacity:0;transform:translateY(10px)} 65%,95%{opacity:1;transform:translateY(0)} 100%{opacity:0} }
          @keyframes pi-bPulse   { 0%,55%{stroke:#2a2a2a} 60%,85%{stroke:rgba(249,115,22,0.5)} 90%,100%{stroke:#2a2a2a} }
        `}</style>

        <rect width="100%" height="100%" fill="url(#pi-grid)" />
        <g className="pi-loop">
          <rect x="50" y="50" width="500" height="320" rx="16" fill="#141417" strokeWidth="1.5" className="pi-border" />

          {/* URL input */}
          <rect x="70" y="70" width="350" height="44" rx="8" fill="#09090b" stroke="#2a2a2b" strokeWidth="1" />
          <text x="86" y="97" fill="#71717a" fontSize="14" fontFamily="monospace">https://</text>
          {/* Text reveal via SVG clipPath - reliable cross-browser */}
          <g clipPath="url(#pi-url-clip)">
            <text x="146" y="97" fill="#e4e4e7" fontSize="14" fontFamily="monospace">hydrabeauty.com/products</text>
          </g>
          {/* Cursor: SVG <animate> on x attribute - no CSS transform conflict */}
          <rect y="82" width="2" height="20" fill="#f97316">
            <animate attributeName="x" values="146;146;346;346;146" keyTimes="0;0.05;0.18;0.97;1" dur="10s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;1;1;0;1" keyTimes="0;0.05;0.19;0.97;1" dur="10s" repeatCount="indefinite" />
          </rect>

          {/* Import button */}
          <g className="pi-btn">
            <rect x="435" y="70" width="95" height="44" rx="8" fill="#f97316" />
            <text x="482.5" y="97" fill="#fff" fontSize="14" fontWeight="600" textAnchor="middle">Import</text>
          </g>

          <line x1="50" y1="135" x2="550" y2="135" stroke="#2a2a2b" strokeWidth="1" />

          {/* Skeleton rows */}
          <g className="pi-skel">
            {[155, 215, 275].map((y, i) => (
              <g key={i} transform={`translate(70, ${y})`}>
                <rect width="44" height="44" rx="8" fill="#27272a" />
                <rect x="60" y="8" width={i === 1 ? 120 : 160} height="12" rx="4" fill="#27272a" />
                <rect x="60" y="28" width="60" height="10" rx="4" fill="#1f1f22" />
              </g>
            ))}
          </g>

          {/* Scan line */}
          <rect x="50" y="145" width="500" height="3" fill="url(#pi-scan-grad)" className="pi-scan" filter="url(#pi-glow)" />

          {/* Revealed product rows
              CRITICAL: outer <g> = position via SVG transform (no className)
                        inner <g> = animation via CSS class (no transform attr)
              Mixing both on the same element causes CSS to override SVG position → all rows at (0,0) */}
          {[
            { y: 155, name: "Hydra Serum",           price: "$45",  cls: "pi-r1" },
            { y: 215, name: "Cloud Runner Sneakers",  price: "$129", cls: "pi-r2" },
            { y: 275, name: "Vital Blend Matcha",     price: "$39",  cls: "pi-r3" },
          ].map((item, i) => (
            <g key={i} transform={`translate(70, ${item.y})`}>
              <g className={item.cls}>
                <rect width="44" height="44" rx="8" fill="#09090b" stroke="#2a2a2b" />
                <circle cx="22" cy="22" r="10" fill="#27272a" />
                <text x="60" y="24" fill="#fff" fontSize="15" fontWeight="600">{item.name}</text>
                <text x="60" y="42" fill="#a1a1aa" fontSize="13">{item.price}</text>
                <circle cx="450" cy="22" r="5" fill="#f97316" filter="url(#pi-glow)" />
              </g>
            </g>
          ))}

          {/* Summary bar */}
          <g className="pi-sum">
            <rect x="70" y="335" width="460" height="4" rx="2" fill="#27272a" />
            <rect x="70" y="335" width="120" height="4" rx="2" fill="#f97316" filter="url(#pi-glow)" />
            <text x="70" y="360" fill="#f97316" fontSize="11" fontWeight="700" letterSpacing="1">AI BRAND SUMMARY GENERATED</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  2. Persona Builder                                                          */
/* -------------------------------------------------------------------------- */

function AnimationPersonaBuilder() {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-zinc-950">
      <svg viewBox="0 0 600 420" className="w-full h-auto block">
        <defs>
          <GridPattern id="pb-grid" />
          <filter id="pb-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="pb-scan-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="80%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="1" />
          </linearGradient>
          {/* Clip the entire avatar panel to its rounded rect */}
          <clipPath id="pb-avatar-clip">
            <rect x="330" y="50" width="230" height="320" rx="16" />
          </clipPath>
          {/* Photo reveal: height animates 0->320 - replaces CSS clip-path:inset() on <g> */}
          <clipPath id="pb-reveal-clip">
            <rect x="330" y="50" width="230" height="0">
              <animate
                attributeName="height"
                values="0;0;320;320;320"
                keyTimes="0;0.55;0.76;0.95;1"
                dur="10s"
                repeatCount="indefinite"
              />
            </rect>
          </clipPath>
        </defs>
        <style>{`
          .pb-loop    { animation: pb-fade       10s ease-in-out                    infinite; }
          .pb-mouse   { animation: pb-mousePath  10s cubic-bezier(0.4,0,0.2,1)      infinite; }
          .pb-click   { animation: pb-clickScale 10s                                infinite; transform-origin: 5px 5px; transform-box: fill-box; }
          .pb-pill1   { animation: pb-pill1Anim  10s                                infinite; }
          .pb-txt1    { animation: pb-txt1Anim   10s                                infinite; }
          .pb-pill2   { animation: pb-pill2Anim  10s                                infinite; }
          .pb-txt2    { animation: pb-txt2Anim   10s                                infinite; }
          .pb-btn     { animation: pb-btnAnim    10s                                infinite; }
          .pb-btnTxt  { animation: pb-btnTxtAnim 10s                                infinite; }
          .pb-wire    { animation: pb-wireFade   10s                                infinite; }
          .pb-scan    { animation: pb-scanDrop   10s cubic-bezier(0.4,0,0.2,1)     infinite; }

          @keyframes pb-fade       { 0%,5%{opacity:0;transform:scale(0.98)} 10%,90%{opacity:1;transform:scale(1)} 95%,100%{opacity:0;transform:scale(0.98)} }
          @keyframes pb-mousePath  { 0%,5%{transform:translate(400px,350px)} 15%,20%{transform:translate(165px,185px)} 35%,40%{transform:translate(165px,275px)} 50%,55%{transform:translate(165px,350px)} 70%,100%{transform:translate(450px,450px)} }
          @keyframes pb-clickScale { 0%,17%,21%,37%,41%,52%,56%,100%{transform:scale(1)} 19%,39%,54%{transform:scale(0.8)} }
          @keyframes pb-pill1Anim  { 0%,19%{fill:transparent;stroke:#2a2a2b} 20%,100%{fill:rgba(99,102,241,0.15);stroke:#6366f1} }
          @keyframes pb-txt1Anim   { 0%,19%{fill:#a1a1aa} 20%,100%{fill:#818cf8} }
          @keyframes pb-pill2Anim  { 0%,39%{fill:transparent;stroke:#2a2a2b} 40%,100%{fill:rgba(99,102,241,0.15);stroke:#6366f1} }
          @keyframes pb-txt2Anim   { 0%,39%{fill:#a1a1aa} 40%,100%{fill:#818cf8} }
          @keyframes pb-btnAnim    { 0%,54%{fill:#18181b;stroke:#2a2a2b;filter:none} 55%,100%{fill:#6366f1;stroke:#6366f1;filter:url(#pb-glow)} }
          @keyframes pb-btnTxtAnim { 0%,54%{fill:#a1a1aa} 55%,100%{fill:#fff} }
          @keyframes pb-wireFade   { 0%,54%{opacity:1} 60%,100%{opacity:0} }
          @keyframes pb-scanDrop   { 0%,55%{transform:translateY(0);opacity:0} 56%{transform:translateY(0);opacity:1} 75%{transform:translateY(310px);opacity:1} 76%,100%{transform:translateY(310px);opacity:0} }
        `}</style>

        <rect width="100%" height="100%" fill="url(#pb-grid)" />
        <g className="pb-loop">
          {/* ── Left panel ── */}
          <rect x="40" y="40" width="260" height="340" rx="16" fill="#09090b" stroke="#2a2a2b" strokeWidth="1.5" />
          <text x="64" y="85" fill="#fff" fontSize="20" fontWeight="700">AI Creator</text>
          <line x1="40" y1="110" x2="300" y2="110" stroke="#2a2a2b" strokeWidth="1.5" />

          <text x="64" y="145" fill="#71717a" fontSize="11" fontWeight="700" letterSpacing="1">SKIN TONE</text>
          <rect x="64"  y="165" width="65" height="36" rx="18" fill="transparent" stroke="#2a2a2b" />
          <text x="96.5"  y="188" fill="#a1a1aa" fontSize="13" textAnchor="middle">Light</text>
          <rect x="137" y="165" width="65" height="36" rx="18" fill="transparent" stroke="#2a2a2b" className="pb-pill1" />
          <text x="169.5" y="188" fontSize="13" textAnchor="middle" className="pb-txt1">Warm</text>
          <rect x="210" y="165" width="65" height="36" rx="18" fill="transparent" stroke="#2a2a2b" />
          <text x="242.5" y="188" fill="#a1a1aa" fontSize="13" textAnchor="middle">Deep</text>

          <text x="64" y="235" fill="#71717a" fontSize="11" fontWeight="700" letterSpacing="1">HAIR STYLE</text>
          <rect x="64"  y="255" width="65" height="36" rx="18" fill="transparent" stroke="#2a2a2b" />
          <text x="96.5"  y="278" fill="#a1a1aa" fontSize="13" textAnchor="middle">Long</text>
          <rect x="137" y="255" width="65" height="36" rx="18" fill="transparent" stroke="#2a2a2b" className="pb-pill2" />
          <text x="169.5" y="278" fontSize="13" textAnchor="middle" className="pb-txt2">Short</text>
          <rect x="210" y="255" width="65" height="36" rx="18" fill="transparent" stroke="#2a2a2b" />
          <text x="242.5" y="278" fill="#a1a1aa" fontSize="13" textAnchor="middle">Curly</text>

          <rect x="64" y="325" width="212" height="44" rx="10" strokeWidth="1" className="pb-btn" />
          <text x="170" y="352" fontSize="15" fontWeight="600" textAnchor="middle" className="pb-btnTxt">Generate Avatar</text>

          {/* ── Right panel (avatar area) ── */}
          <g clipPath="url(#pb-avatar-clip)">
            <rect x="330" y="50" width="230" height="320" fill="#141417" />

            {/* Wireframe placeholder - fades out when avatar generates */}
            <g className="pb-wire" stroke="#2a2a2b" strokeWidth="1.5" fill="none">
              <circle cx="445" cy="160" r="45" strokeDasharray="4 4" />
              <path d="M 365 320 C 365 240, 525 240, 525 320" strokeDasharray="4 4" />
              <line x1="445" y1="50" x2="445" y2="370" strokeDasharray="2 6" strokeOpacity="0.5" />
              <line x1="330" y1="160" x2="560" y2="160" strokeDasharray="2 6" strokeOpacity="0.5" />
            </g>

            {/* Real persona photo - revealed top-down via SVG clipPath (not CSS clip-path:inset) */}
            <image
              href="/img/Gemini_Generated_Image_h670yrh670yrh670-7.png"
              x="330" y="50"
              width="230" height="320"
              preserveAspectRatio="xMidYMin slice"
              clipPath="url(#pb-reveal-clip)"
            />

            {/* Scan line */}
            <g className="pb-scan">
              <rect x="330" y="50" width="230" height="60" fill="url(#pb-scan-grad)" />
              <line x1="330" y1="110" x2="560" y2="110" stroke="#818cf8" strokeWidth="2" filter="url(#pb-glow)" />
            </g>
          </g>

          {/* Avatar panel border (crisp, on top of clip) */}
          <rect x="330" y="40" width="230" height="330" rx="16" fill="none" stroke="#2a2a2b" strokeWidth="1.5" />
          {/* 100% badge removed */}

          {/* Mouse cursor */}
          <g className="pb-mouse">
            <g className="pb-click">
              <path d="M 0 0 L 16 16 L 10 16 L 15 25 L 11 27 L 6 17 L 0 23 Z" fill="#ffffff" stroke="#000" strokeWidth="1" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  3. Video / Script Generation                                                */
/* -------------------------------------------------------------------------- */

function AnimationVideoGeneration() {
  const P = 1116; // perimeter of 480×88 rect with rx=12

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-zinc-950">
      <svg viewBox="0 0 600 420" className="w-full h-auto block">
        <defs>
          <GridPattern id="vg-grid" />
          <filter id="vg-glow-o" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="vg-glow-i" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="vg-glow-g" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* SVG clipPaths for text reveal - replaces unreliable CSS clip-path:inset() on <g>
              Coords are in the coordinate system of each row's translate() group */}
          <clipPath id="vg-clip1">
            <rect x="0" y="0" height="88">
              <animate attributeName="width" values="0;0;480;480" keyTimes="0;0.05;0.25;1" dur="10s" repeatCount="indefinite" />
            </rect>
          </clipPath>
          <clipPath id="vg-clip2">
            <rect x="0" y="0" height="88">
              <animate attributeName="width" values="0;0;0;480;480" keyTimes="0;0.05;0.26;0.46;1" dur="10s" repeatCount="indefinite" />
            </rect>
          </clipPath>
          <clipPath id="vg-clip3">
            <rect x="0" y="0" height="88">
              <animate attributeName="width" values="0;0;0;0;480;480" keyTimes="0;0.05;0.26;0.51;0.71;1" dur="10s" repeatCount="indefinite" />
            </rect>
          </clipPath>
        </defs>
        <style>{`
          .vg-loop  { animation: vg-fade  10s ease-in-out                    infinite; }
          .vg-bg1   { animation: vg-bg1a  10s                                infinite; }
          .vg-bg2   { animation: vg-bg2a  10s                                infinite; }
          .vg-bg3   { animation: vg-bg3a  10s                                infinite; }
          .vg-draw1 { stroke-dasharray: ${P}; animation: vg-d1 10s cubic-bezier(0.65,0,0.35,1) infinite; }
          .vg-draw2 { stroke-dasharray: ${P}; animation: vg-d2 10s cubic-bezier(0.65,0,0.35,1) infinite; }
          .vg-draw3 { stroke-dasharray: ${P}; animation: vg-d3 10s cubic-bezier(0.65,0,0.35,1) infinite; }

          @keyframes vg-fade { 0%,5%{opacity:0;transform:scale(0.98)} 10%,90%{opacity:1;transform:scale(1)} 95%,100%{opacity:0;transform:scale(0.98)} }
          @keyframes vg-bg1a { 0%,25%{fill:rgba(249,115,22,0.08)} 26%,100%{fill:#141417} }
          @keyframes vg-d1   { 0%,5%{stroke-dashoffset:${P};stroke:#2a2a2b;filter:none} 15%,25%{stroke-dashoffset:0;stroke:#f97316;filter:url(#vg-glow-o)} 26%,100%{stroke-dashoffset:0;stroke:rgba(249,115,22,0.3);filter:none} }
          @keyframes vg-bg2a { 0%,25%{fill:#141417} 26%,50%{fill:rgba(99,102,241,0.08)} 51%,100%{fill:#141417} }
          @keyframes vg-d2   { 0%,26%{stroke-dashoffset:${P};stroke:#2a2a2b;filter:none} 36%,50%{stroke-dashoffset:0;stroke:#6366f1;filter:url(#vg-glow-i)} 51%,100%{stroke-dashoffset:0;stroke:rgba(99,102,241,0.3);filter:none} }
          @keyframes vg-bg3a { 0%,50%{fill:#141417} 51%,75%{fill:rgba(34,197,94,0.08)} 76%,100%{fill:#141417} }
          @keyframes vg-d3   { 0%,51%{stroke-dashoffset:${P};stroke:#2a2a2b;filter:none} 61%,75%{stroke-dashoffset:0;stroke:#22c55e;filter:url(#vg-glow-g)} 76%,100%{stroke-dashoffset:0;stroke:rgba(34,197,94,0.3);filter:none} }
        `}</style>

        <rect width="100%" height="100%" fill="url(#vg-grid)" />
        <g className="vg-loop">
          {/* HOOK row */}
          <g transform="translate(60, 40)">
            <rect width="480" height="88" rx="12" stroke="#2a2a2b" strokeWidth="1" className="vg-bg1" />
            <rect width="480" height="88" rx="12" fill="none" strokeWidth="2.5" className="vg-draw1" />
            <text x="24" y="28" fill="#71717a" fontSize="12" fontWeight="700" letterSpacing="1.5">HOOK</text>
            <g clipPath="url(#vg-clip1)">
              <text x="24" y="60" fill="#fff" fontSize="16">&ldquo;Stop scrolling. This changed my skin in 7 days.&rdquo;</text>
            </g>
          </g>

          {/* BODY row */}
          <g transform="translate(60, 145)">
            <rect width="480" height="88" rx="12" stroke="#2a2a2b" strokeWidth="1" className="vg-bg2" />
            <rect width="480" height="88" rx="12" fill="none" strokeWidth="2.5" className="vg-draw2" />
            <text x="24" y="28" fill="#71717a" fontSize="12" fontWeight="700" letterSpacing="1.5">BODY</text>
            <g clipPath="url(#vg-clip2)">
              <text x="24" y="60" fill="#fff" fontSize="16">&ldquo;Hydra Serum uses clinically-tested peptides...&rdquo;</text>
            </g>
          </g>

          {/* CTA row */}
          <g transform="translate(60, 250)">
            <rect width="480" height="88" rx="12" stroke="#2a2a2b" strokeWidth="1" className="vg-bg3" />
            <rect width="480" height="88" rx="12" fill="none" strokeWidth="2.5" className="vg-draw3" />
            <text x="24" y="28" fill="#71717a" fontSize="12" fontWeight="700" letterSpacing="1.5">CTA</text>
            <g clipPath="url(#vg-clip3)">
              <text x="24" y="60" fill="#fff" fontSize="16">&ldquo;Tap below and try it risk-free for 30 days.&rdquo;</text>
            </g>
          </g>
          {/* "3 segments ready" badge removed */}
        </g>
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  4. Segment Mixer                                                            */
/* -------------------------------------------------------------------------- */

function AnimationSegmentMixer() {
  const W = 140, H = 70;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-zinc-950">
      <svg viewBox="0 0 600 420" className="w-full h-auto block">
        <defs>
          <GridPattern id="sm-grid" />
        </defs>
        <style>{`
          .sm-loop { animation: sm-fade 10s ease-in-out infinite; }
          @keyframes sm-fade { 0%,5%{opacity:0;transform:scale(0.98)} 10%,90%{opacity:1;transform:scale(1)} 95%,100%{opacity:0;transform:scale(0.98)} }

          @keyframes sm-n1 { 0%,20%,80%,100%{stroke:#2a2a2b;fill:#141417;transform:scale(1)} 25%,75%{stroke:#f97316;fill:rgba(249,115,22,0.15);transform:scale(1.04)} }
          @keyframes sm-t1 { 0%,20%,80%,100%{fill:#71717a} 25%,75%{fill:#fff} }
          @keyframes sm-n2 { 0%,40%,80%,100%{stroke:#2a2a2b;fill:#141417;transform:scale(1)} 45%,75%{stroke:#6366f1;fill:rgba(99,102,241,0.15);transform:scale(1.04)} }
          @keyframes sm-t2 { 0%,40%,80%,100%{fill:#71717a} 45%,75%{fill:#fff} }
          @keyframes sm-n3 { 0%,60%,80%,100%{stroke:#2a2a2b;fill:#141417;transform:scale(1)} 65%,75%{stroke:#22c55e;fill:rgba(34,197,94,0.15);transform:scale(1.04)} }
          @keyframes sm-t3 { 0%,60%,80%,100%{fill:#71717a} 65%,75%{fill:#fff} }

          .sm-node { stroke-width:1.5px; }
          .sm-nt { font-size:14px; font-weight:600; text-anchor:middle; dominant-baseline:central; }

          .sm-hA { animation:sm-n1 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-thA { animation:sm-t1 10s infinite; }
          .sm-hB { animation:sm-n2 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-thB { animation:sm-t2 10s infinite; }
          .sm-hC { animation:sm-n3 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-thC { animation:sm-t3 10s infinite; }
          .sm-bA { animation:sm-n3 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-tbA { animation:sm-t3 10s infinite; }
          .sm-bB { animation:sm-n1 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-tbB { animation:sm-t1 10s infinite; }
          .sm-bC { animation:sm-n2 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-tbC { animation:sm-t2 10s infinite; }
          .sm-cA { animation:sm-n1 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-tcA { animation:sm-t1 10s infinite; }
          .sm-cB { animation:sm-n2 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-tcB { animation:sm-t2 10s infinite; }
          .sm-cC { animation:sm-n3 10s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin:center; transform-box:fill-box; } .sm-tcC { animation:sm-t3 10s infinite; }

          .sm-conn { fill:none; stroke-width:2; stroke-linecap:round; stroke-dasharray:8 8; opacity:0.15; stroke:#52525b; }
          .sm-c1 { fill:none; stroke-width:2; stroke-linecap:round; stroke-dasharray:8 8; stroke:#f97316; animation:sm-flow1 10s infinite; }
          .sm-c2 { fill:none; stroke-width:2; stroke-linecap:round; stroke-dasharray:8 8; stroke:#6366f1; animation:sm-flow2 10s infinite; }
          .sm-c3 { fill:none; stroke-width:2; stroke-linecap:round; stroke-dasharray:8 8; stroke:#22c55e; animation:sm-flow3 10s infinite; }
          @keyframes sm-flow1 { 0%,20%,80%,100%{stroke-dashoffset:100;opacity:0} 25%,75%{stroke-dashoffset:0;opacity:0.9} }
          @keyframes sm-flow2 { 0%,40%,80%,100%{stroke-dashoffset:100;opacity:0} 45%,75%{stroke-dashoffset:0;opacity:0.9} }
          @keyframes sm-flow3 { 0%,60%,80%,100%{stroke-dashoffset:100;opacity:0} 65%,75%{stroke-dashoffset:0;opacity:0.9} }

          .sm-flash { animation:sm-flashAnim 10s infinite; }
          @keyframes sm-flashAnim { 0%,74%{opacity:0} 75%,85%{opacity:1} 86%,100%{opacity:0} }
        `}</style>

        <rect width="100%" height="100%" fill="url(#sm-grid)" />
        <g className="sm-loop">
          <text x="110" y="60" fill="#71717a" fontSize="13" fontWeight="700" letterSpacing="1.5" textAnchor="middle">HOOKS</text>
          <text x="300" y="60" fill="#71717a" fontSize="13" fontWeight="700" letterSpacing="1.5" textAnchor="middle">BODIES</text>
          <text x="490" y="60" fill="#71717a" fontSize="13" fontWeight="700" letterSpacing="1.5" textAnchor="middle">CTAS</text>

          <path className="sm-conn" d="M 180 125 C 215 125, 215 125, 230 125 M 370 125 C 385 125, 385 125, 420 125" />
          <path className="sm-conn" d="M 180 235 C 215 235, 215 235, 230 235 M 370 235 C 385 235, 385 235, 420 235" />
          <path className="sm-conn" d="M 180 345 C 215 345, 215 345, 230 345 M 370 345 C 385 345, 385 345, 420 345" />

          <path className="sm-c1" d="M 180 125 C 215 125, 215 235, 230 235 M 370 235 C 385 235, 385 125, 420 125" />
          <path className="sm-c2" d="M 180 235 C 215 235, 215 345, 230 345 M 370 345 C 385 345, 385 235, 420 235" />
          <path className="sm-c3" d="M 180 345 C 215 345, 215 125, 230 125 M 370 125 C 385 125, 385 345, 420 345" />

          <g transform="translate(40, 90)">  <rect width={W} height={H} rx="12" className="sm-node sm-hA" /><text x={W/2} y={H/2} className="sm-nt sm-thA">Hook A</text></g>
          <g transform="translate(40, 200)"> <rect width={W} height={H} rx="12" className="sm-node sm-hB" /><text x={W/2} y={H/2} className="sm-nt sm-thB">Hook B</text></g>
          <g transform="translate(40, 310)"> <rect width={W} height={H} rx="12" className="sm-node sm-hC" /><text x={W/2} y={H/2} className="sm-nt sm-thC">Hook C</text></g>

          <g transform="translate(230, 90)"> <rect width={W} height={H} rx="12" className="sm-node sm-bA" /><text x={W/2} y={H/2} className="sm-nt sm-tbA">Body A</text></g>
          <g transform="translate(230, 200)"><rect width={W} height={H} rx="12" className="sm-node sm-bB" /><text x={W/2} y={H/2} className="sm-nt sm-tbB">Body B</text></g>
          <g transform="translate(230, 310)"><rect width={W} height={H} rx="12" className="sm-node sm-bC" /><text x={W/2} y={H/2} className="sm-nt sm-tbC">Body C</text></g>

          <g transform="translate(420, 90)"> <rect width={W} height={H} rx="12" className="sm-node sm-cA" /><text x={W/2} y={H/2} className="sm-nt sm-tcA">CTA A</text></g>
          <g transform="translate(420, 200)"><rect width={W} height={H} rx="12" className="sm-node sm-cB" /><text x={W/2} y={H/2} className="sm-nt sm-tcB">CTA B</text></g>
          <g transform="translate(420, 310)"><rect width={W} height={H} rx="12" className="sm-node sm-cC" /><text x={W/2} y={H/2} className="sm-nt sm-tcC">CTA C</text></g>

          <g className="sm-flash" style={{ pointerEvents: "none" }}>
            <rect width="600" height="420" fill="rgba(255,255,255,0.04)" />
            <text x="300" y="220" fill="#ffffff" fontSize="48" fontWeight="800" textAnchor="middle"
              style={{ filter: "drop-shadow(0 0 24px rgba(255,255,255,0.6))" }}>
              27 COMBOS
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Features data                                                              */
/* -------------------------------------------------------------------------- */

const features = [
  {
    title: ["Zero-Input Product ", "Import"],
    description:
      "Paste any Shopify or e-commerce URL. CineRads extracts products, images, prices, and descriptions, then generates a complete brand profile with AI. No CSV uploads, no data entry.",
    subtext: "Works with Shopify, WooCommerce, and any public product page.",
    bullets: [
      "Auto-detect product data from any URL",
      "Bulk import entire catalogs",
      "Edit and confirm products in dashboard",
    ],
    mock: <AnimationProductImport />,
    reversed: false,
  },
  {
    title: ["Your AI Brand ", "Spokesperson"],
    description:
      "Design a virtual spokesperson with 9 customizable attributes: skin tone, hair, clothing, age, and more. Save once and reuse the same face across every campaign for brand consistency.",
    subtext: "Create multiple personas per brand.",
    bullets: [
      "9 customizable persona attributes",
      "Consistent brand identity across all ads",
      "Multiple personas per brand",
    ],
    mock: <AnimationPersonaBuilder />,
    reversed: true,
  },
  {
    title: ["Scripts ", "Written For You"],
    description:
      "AI writes attention-grabbing hooks, benefit-driven bodies, and urgency CTAs, all tuned to your product data and brand voice. Each segment is generated as a short, crisp video clip. No copywriting skills needed.",
    subtext: "Under 10s per segment for perfect lip-sync.",
    bullets: [
      "AI-generated scripts tuned to your product",
      "Hook, Body & CTA structure built-in",
      "Single or 3x batch generation",
    ],
    mock: <AnimationVideoGeneration />,
    reversed: false,
  },
  {
    title: ["27 Ad Combos From ", "9 Segments"],
    description:
      "Generate 3 hooks, 3 bodies, and 3 CTAs. Mix and match any combination for 27 unique video ads from a single generation. Assembly is instant. No extra credits.",
    subtext: "A/B test hooks, bodies, and CTAs at scale.",
    bullets: [
      "27 unique ad combinations per batch",
      "Download individual segments or full videos",
      "A/B test hooks, bodies, and CTAs",
    ],
    mock: <AnimationSegmentMixer />,
    reversed: true,
  },
];

/* -------------------------------------------------------------------------- */
/*  Section                                                                    */
/* -------------------------------------------------------------------------- */

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">Features</p>
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold tracking-tight text-foreground">
            Everything You Need to Create{" "}
            <span className="font-serif italic text-primary">UGC Video Ads</span>{" "}
            at Scale
          </h2>
        </div>

        {features.map((feature, i) => (
          <div
            key={i}
            className={`flex flex-col gap-10 md:gap-12 py-14 first:pt-0 last:pb-0 ${
              feature.reversed ? "md:flex-row-reverse" : "md:flex-row"
            } items-center`}
          >
            <motion.div
              {...(feature.reversed ? slideInRight : slideInLeft)}
              whileInView={feature.reversed ? slideInRight.animate : slideInLeft.animate}
              viewport={{ once: true }}
              className="flex-1 space-y-5"
            >
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
                {feature.title[0]}
                <span className="font-serif italic text-primary">{feature.title[1]}</span>
              </h3>
              <p className="text-muted-foreground text-base leading-relaxed">
                {feature.description}
              </p>
              {feature.subtext && (
                <p className="text-primary text-sm font-medium">{feature.subtext}</p>
              )}
              <ul className="space-y-2.5">
                {feature.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-center gap-3 text-sm">
                    <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="size-3 text-primary" />
                    </div>
                    {bullet}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              {...(feature.reversed ? slideInLeft : slideInRight)}
              whileInView={feature.reversed ? slideInLeft.animate : slideInRight.animate}
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
