"use client";

import { motion } from "framer-motion";
import { slideInLeft, slideInRight } from "@/lib/animations";
import { Check } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  SVG Animation strings                                                      */
/* -------------------------------------------------------------------------- */

const svgProductImport = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" style="display:block;width:100%;height:auto;background-color:#111111;">
  <defs>
    <filter id="glow-1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="card-glow-1" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="8" result="blur" /><feComponentTransfer in="blur" result="fadedBlur"><feFuncA type="linear" slope="0.3" /></feComponentTransfer><feMerge><feMergeNode in="fadedBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <linearGradient id="scan-grad-1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f97316" stop-opacity="0" /><stop offset="50%" stop-color="#f97316" stop-opacity="1" /><stop offset="100%" stop-color="#f97316" stop-opacity="0" /></linearGradient>
    <clipPath id="type-clip-1"><rect x="132" y="70" height="40" width="0"><animate attributeName="width" values="0;0;220;220;220;0" keyTimes="0;0.05;0.24;0.95;0.98;1" dur="5s" repeatCount="indefinite" /></rect></clipPath>
    <clipPath id="summary-clip-1"><rect x="70" y="325" height="40" width="0"><animate attributeName="width" values="0;0;450;450;450;0" keyTimes="0;0.76;0.88;0.95;0.98;1" dur="5s" repeatCount="indefinite" /></rect></clipPath>
  </defs>
  <style>
    .global-anim-1 { animation: loop-fade-1 5s infinite; }
    .btn-pulse-1 { animation: pulse-1 5s infinite; transform-origin: center; }
    .scanline-1 { animation: scan-1 5s infinite; }
    .skeleton-1 { animation: skel-fade-1 5s infinite; }
    .row-1-1 { animation: row-reveal-1 5s infinite; animation-delay: 0s; }
    .row-2-1 { animation: row-reveal-1 5s infinite; animation-delay: 0.4s; }
    .row-3-1 { animation: row-reveal-1 5s infinite; animation-delay: 0.8s; }
    .card-border-1 { animation: card-glow-anim-1 5s infinite; }
    .brand-summary-label-1 { animation: summary-fade-1 5s infinite; }
    @keyframes loop-fade-1 { 0%, 92% { opacity: 1; } 98%, 100% { opacity: 0; } }
    @keyframes pulse-1 { 0%, 15% { transform: scale(1); filter: none; opacity: 0.8; } 20% { transform: scale(1.05); filter: url(#glow-1); opacity: 1; } 25%, 100% { transform: scale(1); filter: none; opacity: 0.8; } }
    @keyframes scan-1 { 0%, 23% { opacity: 0; transform: translateY(0); } 24% { opacity: 1; transform: translateY(0); } 40% { opacity: 0; transform: translateY(160px); } 100% { opacity: 0; transform: translateY(160px); } }
    @keyframes skel-fade-1 { 0%, 24% { opacity: 0; } 25%, 35% { opacity: 1; } 40%, 100% { opacity: 0; } }
    @keyframes row-reveal-1 { 0%, 40% { opacity: 0; transform: translateY(8px); } 45%, 95% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(0); } }
    @keyframes card-glow-anim-1 { 0%, 55% { stroke: #2a2a2a; filter: none; } 65%, 90% { stroke: #f97316; filter: url(#card-glow-1); } 95%, 100% { stroke: #2a2a2a; filter: none; } }
    @keyframes summary-fade-1 { 0%, 75% { opacity: 0; } 78%, 95% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes blink-cursor-1 { 0%, 49% { opacity: 1; } 50%, 100% { opacity: 0; } }
  </style>
  <g class="global-anim-1">
    <rect x="50" y="50" width="500" height="320" rx="12" fill="#1c1c1c" stroke="#2a2a2a" stroke-width="1.5" class="card-border-1"/>
    <rect x="70" y="70" width="360" height="40" rx="6" fill="#111" stroke="#2a2a2a" stroke-width="1"/>
    <text x="82" y="95" fill="#6b7280" font-size="14">https://</text>
    <g clip-path="url(#type-clip-1)"><text x="132" y="95" fill="#fff" font-size="14">hydrabeauty.com/products</text></g>
    <rect y="82" width="2" height="16" fill="#f97316" style="animation: blink-cursor-1 0.8s infinite;">
      <animate attributeName="x" values="132;132;325;325;325;132" keyTimes="0;0.05;0.24;0.95;0.98;1" dur="5s" repeatCount="indefinite" />
    </rect>
    <g class="btn-pulse-1" style="transform-box: fill-box;">
      <rect x="440" y="70" width="90" height="40" rx="6" fill="#f97316" />
      <text x="485" y="94" fill="#fff" font-size="13" font-weight="600" text-anchor="middle">Import</text>
    </g>
    <line x1="50" y1="130" x2="550" y2="130" stroke="#2a2a2a" stroke-width="1" />
    <g class="skeleton-1">
      <g transform="translate(70, 150)"><rect width="40" height="40" rx="4" fill="#2a2a2a" /><rect x="52" y="6" width="120" height="12" rx="2" fill="#2a2a2a" /><rect x="52" y="24" width="60" height="10" rx="2" fill="#222" /></g>
      <g transform="translate(70, 205)"><rect width="40" height="40" rx="4" fill="#2a2a2a" /><rect x="52" y="6" width="100" height="12" rx="2" fill="#2a2a2a" /><rect x="52" y="24" width="50" height="10" rx="2" fill="#222" /></g>
      <g transform="translate(70, 260)"><rect width="40" height="40" rx="4" fill="#2a2a2a" /><rect x="52" y="6" width="140" height="12" rx="2" fill="#2a2a2a" /><rect x="52" y="24" width="70" height="10" rx="2" fill="#222" /></g>
    </g>
    <rect x="50" y="140" width="500" height="2" fill="url(#scan-grad-1)" class="scanline-1" filter="url(#glow-1)"/>
    <g class="row-1-1"><g transform="translate(70, 150)"><rect width="40" height="40" rx="4" fill="#111" stroke="#2a2a2a" /><circle cx="20" cy="20" r="10" fill="#2a2a2a" /><text x="52" y="20" fill="#fff" font-size="15" font-weight="600">Hydra Serum</text><text x="52" y="36" fill="#6b7280" font-size="13">$45</text><circle cx="450" cy="20" r="4" fill="#f97316" filter="url(#glow-1)"/></g></g>
    <g class="row-2-1"><g transform="translate(70, 205)"><rect width="40" height="40" rx="4" fill="#111" stroke="#2a2a2a" /><circle cx="20" cy="20" r="10" fill="#2a2a2a" /><text x="52" y="20" fill="#fff" font-size="15" font-weight="600">Cloud Runner</text><text x="52" y="36" fill="#6b7280" font-size="13">$129</text><circle cx="450" cy="20" r="4" fill="#f97316" filter="url(#glow-1)"/></g></g>
    <g class="row-3-1"><g transform="translate(70, 260)"><rect width="40" height="40" rx="4" fill="#111" stroke="#2a2a2a" /><circle cx="20" cy="20" r="10" fill="#2a2a2a" /><text x="52" y="20" fill="#fff" font-size="15" font-weight="600">Vital Blend</text><text x="52" y="36" fill="#6b7280" font-size="13">$39</text><circle cx="450" cy="20" r="4" fill="#f97316" filter="url(#glow-1)"/></g></g>
    <g class="brand-summary-label-1"><text x="70" y="330" fill="#f97316" font-size="11" font-weight="700" letter-spacing="0.5">BRAND SUMMARY</text></g>
    <g clip-path="url(#summary-clip-1)"><text x="70" y="348" fill="#fff" font-size="14">Premium skincare &amp; lifestyle. Target: 25-34 women.</text></g>
  </g>
</svg>`;

const svgPersonaBuilder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" style="display:block;width:100%;height:auto;background-color:#111111;">
  <defs>
    <filter id="glow-2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <linearGradient id="scan-2" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0" />
      <stop offset="80%" stop-color="#f97316" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#f97316" stop-opacity="1" />
    </linearGradient>
    <clipPath id="avatar-clip-2"><rect x="330" y="60" width="220" height="300" rx="12" /></clipPath>
  </defs>
  <style>
    .global-anim-2 { animation: loop-fade-2 7s infinite; }
    @keyframes loop-fade-2 { 0%, 5% { opacity: 0; } 10%, 95% { opacity: 1; } 100% { opacity: 0; } }
    .mouse { animation: mouse-move-2 7s cubic-bezier(0.25, 1, 0.5, 1) infinite; }
    .mouse-click { animation: mouse-click-2 7s infinite; transform-origin: top left; }
    @keyframes mouse-move-2 {
      0%, 10% { transform: translate(400px, 350px); }
      20%, 30% { transform: translate(175px, 205px); }
      40%, 50% { transform: translate(175px, 295px); }
      60%, 70% { transform: translate(180px, 360px); }
      80%, 100% { transform: translate(450px, 450px); }
    }
    @keyframes mouse-click-2 {
      0%, 23%, 27%, 43%, 47%, 63%, 67%, 100% { transform: scale(1); }
      25%, 45%, 65% { transform: scale(0.8); }
    }
    .pill-warm { animation: p-warm 7s infinite; }
    .txt-warm { animation: t-warm 7s infinite; }
    .pill-short { animation: p-short 7s infinite; }
    .txt-short { animation: t-short 7s infinite; }
    .btn-gen { animation: b-gen 7s infinite; }
    .txt-gen { animation: tg-gen 7s infinite; }
    @keyframes p-warm { 0%, 24% { fill: transparent; stroke: #2a2a2a; } 25%, 100% { fill: rgba(249,115,22,0.15); stroke: #f97316; } }
    @keyframes t-warm { 0%, 24% { fill: #9ca3af; } 25%, 100% { fill: #f97316; font-weight: 700; } }
    @keyframes p-short { 0%, 44% { fill: transparent; stroke: #2a2a2a; } 45%, 100% { fill: rgba(249,115,22,0.15); stroke: #f97316; } }
    @keyframes t-short { 0%, 44% { fill: #9ca3af; } 45%, 100% { fill: #f97316; font-weight: 700; } }
    @keyframes b-gen { 0%, 64% { fill: #1c1c1c; stroke: #2a2a2a; } 65%, 100% { fill: #f97316; stroke: #f97316; filter: url(#glow-2); } }
    @keyframes tg-gen { 0%, 64% { fill: #fff; } 65%, 100% { fill: #111; font-weight: 800; } }
    .placeholder { animation: ph-fade 7s infinite; }
    .scanner { animation: scan-bar-2 7s infinite; }
    .portrait { animation: face-fade 7s infinite; }
    @keyframes ph-fade { 0%, 72% { opacity: 1; } 78%, 100% { opacity: 0; } }
    @keyframes scan-bar-2 {
      0%, 68% { transform: translateY(0px); opacity: 0; }
      69% { transform: translateY(0px); opacity: 1; }
      85% { transform: translateY(350px); opacity: 1; }
      86%, 100% { transform: translateY(350px); opacity: 0; }
    }
    @keyframes face-fade { 0%, 70% { opacity: 0; } 80%, 100% { opacity: 1; } }
  </style>
  <g class="global-anim-2">
    <rect x="40" y="40" width="250" height="340" rx="12" fill="none" stroke="#2a2a2a" stroke-width="1.5" />
    <text x="60" y="85" fill="#fff" font-size="18" font-weight="700">Simulate Persona</text>
    <line x1="40" y1="110" x2="290" y2="110" stroke="#2a2a2a" stroke-width="1.5" />
    <text x="60" y="150" fill="#6b7280" font-size="11" font-weight="700" letter-spacing="1">SKIN TONE</text>
    <rect x="60" y="170" width="60" height="32" rx="16" fill="transparent" stroke="#2a2a2a" />
    <text x="90" y="190" fill="#9ca3af" font-size="13" text-anchor="middle">Light</text>
    <rect x="135" y="170" width="60" height="32" rx="16" class="pill-warm" />
    <text x="165" y="190" font-size="13" text-anchor="middle" class="txt-warm">Warm</text>
    <rect x="210" y="170" width="60" height="32" rx="16" fill="transparent" stroke="#2a2a2a" />
    <text x="240" y="190" fill="#9ca3af" font-size="13" text-anchor="middle">Deep</text>
    <text x="60" y="240" fill="#6b7280" font-size="11" font-weight="700" letter-spacing="1">HAIR STYLE</text>
    <rect x="60" y="260" width="60" height="32" rx="16" fill="transparent" stroke="#2a2a2a" />
    <text x="90" y="280" fill="#9ca3af" font-size="13" text-anchor="middle">Long</text>
    <rect x="135" y="260" width="60" height="32" rx="16" class="pill-short" />
    <text x="165" y="280" font-size="13" text-anchor="middle" class="txt-short">Short</text>
    <rect x="210" y="260" width="60" height="32" rx="16" fill="transparent" stroke="#2a2a2a" />
    <text x="240" y="280" fill="#9ca3af" font-size="13" text-anchor="middle">Curly</text>
    <rect x="60" y="320" width="210" height="40" rx="8" class="btn-gen" />
    <text x="165" y="345" font-size="15" font-weight="700" text-anchor="middle" class="txt-gen">Generate Avatar</text>
    <rect x="310" y="40" width="260" height="340" rx="12" fill="none" stroke="#2a2a2a" stroke-width="1.5" />
    <g clip-path="url(#avatar-clip-2)">
      <rect x="330" y="60" width="220" height="300" fill="#1c1c1c" />
      <g class="placeholder" stroke="#2a2a2a" stroke-width="1.5" fill="none">
        <circle cx="440" cy="160" r="40" stroke-dasharray="4 4" />
        <path d="M 360 300 C 360 230, 520 230, 520 300" stroke-dasharray="4 4" />
      </g>
      <g class="portrait">
        <rect x="330" y="60" width="220" height="300" fill="#2a2a2a" rx="0" />
        <circle cx="440" cy="175" r="55" fill="#3a3a3a" />
        <ellipse cx="440" cy="340" rx="80" ry="60" fill="#3a3a3a" />
        <circle cx="440" cy="155" r="35" fill="#4a4a4a" />
        <rect x="345" y="75" width="56" height="22" rx="4" fill="#0a0a0a" fill-opacity="0.8" stroke="#22c55e" stroke-width="1" />
        <circle cx="355" cy="86" r="3" fill="#22c55e" filter="url(#glow-2)"/>
        <text x="365" y="90" fill="#22c55e" font-size="11" font-weight="700" letter-spacing="1">100%</text>
      </g>
      <rect class="scanner" x="330" y="60" width="220" height="50" fill="url(#scan-2)" filter="url(#glow-2)" />
    </g>
    <g class="mouse">
      <g class="mouse-click">
        <path d="M 0 0 L 15 15 L 9 15 L 14 24 L 10 26 L 5 16 L 0 22 Z" fill="#ffffff" filter="drop-shadow(0px 3px 5px rgba(0,0,0,0.8))"/>
      </g>
    </g>
  </g>
</svg>`;

const svgVideoGeneration = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" style="display:block;width:100%;height:auto;background-color:#111111;">
  <defs>
    <filter id="glow-orange-3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur" /><feComponentTransfer in="blur" result="fadedBlur"><feFuncA type="linear" slope="0.5" /></feComponentTransfer><feMerge><feMergeNode in="fadedBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="glow-indigo-3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur" /><feComponentTransfer in="blur" result="fadedBlur"><feFuncA type="linear" slope="0.5" /></feComponentTransfer><feMerge><feMergeNode in="fadedBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="glow-green-3" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="blur" /><feComponentTransfer in="blur" result="fadedBlur"><feFuncA type="linear" slope="0.5" /></feComponentTransfer><feMerge><feMergeNode in="fadedBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <clipPath id="hook-clip-3"><rect x="0" y="0" height="80" width="0"><animate attributeName="width" values="0;0;420;420;420" keyTimes="0;0.1;0.35;0.97;1" dur="7s" repeatCount="indefinite" /></rect></clipPath>
    <clipPath id="body-clip-3"><rect x="0" y="0" height="80" width="0"><animate attributeName="width" values="0;0;450;450;450" keyTimes="0;0.35;0.64;0.97;1" dur="7s" repeatCount="indefinite" /></rect></clipPath>
    <clipPath id="cta-clip-3"><rect x="0" y="0" height="80" width="0"><animate attributeName="width" values="0;0;380;380;380" keyTimes="0;0.64;0.88;0.97;1" dur="7s" repeatCount="indefinite" /></rect></clipPath>
  </defs>
  <style>
    .global-anim-3 { animation: loop-fade-3 7s infinite; }
    .border-hook-3 { stroke-dasharray: 1088; animation: draw-hook-3 7s ease-in-out infinite; }
    .border-body-3 { stroke-dasharray: 1088; animation: draw-body-3 7s ease-in-out infinite; }
    .border-cta-3 { stroke-dasharray: 1088; animation: draw-cta-3 7s ease-in-out infinite; }
    .cursor-hook-3 { animation: blink-hook-3 7s infinite; }
    .cursor-body-3 { animation: blink-body-3 7s infinite; }
    .cursor-cta-3 { animation: blink-cta-3 7s infinite; }
    .badge-anim { animation: badge-appear-bottom-3 7s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
    @keyframes loop-fade-3 { 0%, 4% { opacity: 0; transform: translateY(10px); } 8%, 97% { opacity: 1; transform: translateY(0); } 99%, 100% { opacity: 0; transform: translateY(-10px); } }
    @keyframes draw-hook-3 { 0%, 4% { stroke-dashoffset: 1088; stroke: #2a2a2a; filter: none; } 15%, 35% { stroke-dashoffset: 0; stroke: #f97316; filter: url(#glow-orange-3); } 36%, 88% { stroke-dashoffset: 0; stroke: #f97316; filter: none; opacity: 0.5; } 88%, 97% { stroke-dashoffset: 0; stroke: #f97316; filter: url(#glow-orange-3); opacity: 1; } 100% { stroke-dashoffset: 0; } }
    @keyframes draw-body-3 { 0%, 35% { stroke-dashoffset: 1088; stroke: #2a2a2a; filter: none; } 45%, 64% { stroke-dashoffset: 0; stroke: #6366f1; filter: url(#glow-indigo-3); } 65%, 88% { stroke-dashoffset: 0; stroke: #6366f1; filter: none; opacity: 0.5; } 88%, 97% { stroke-dashoffset: 0; stroke: #6366f1; filter: url(#glow-indigo-3); opacity: 1; } 100% { stroke-dashoffset: 0; } }
    @keyframes draw-cta-3 { 0%, 64% { stroke-dashoffset: 1088; stroke: #2a2a2a; filter: none; } 75%, 97% { stroke-dashoffset: 0; stroke: #22c55e; filter: url(#glow-green-3); } 100% { stroke-dashoffset: 0; } }
    @keyframes blink-hook-3 { 0%, 9%, 36%, 100% { opacity: 0; } 10%, 35% { opacity: 1; } }
    @keyframes blink-body-3 { 0%, 34%, 65%, 100% { opacity: 0; } 35%, 64% { opacity: 1; } }
    @keyframes blink-cta-3 { 0%, 63%, 89%, 100% { opacity: 0; } 64%, 88% { opacity: 1; } }
    @keyframes badge-appear-bottom-3 {
      0%, 82% { opacity: 0; transform: scale(0.9) translateY(10px); }
      85%, 96% { opacity: 1; transform: scale(1) translateY(0); filter: drop-shadow(0 4px 12px rgba(34,197,94,0.4)); }
      100% { opacity: 0; transform: scale(0.9) translateY(10px); }
    }
  </style>
  <g class="global-anim-3">
    <g transform="translate(70, 40)"><rect width="460" height="84" rx="10" fill="#1c1c1c" stroke="#2a2a2a" stroke-width="1" /><rect width="460" height="84" rx="10" fill="none" stroke-width="2" class="border-hook-3" /><text x="20" y="25" fill="#6b7280" font-size="11" font-weight="700" letter-spacing="1">HOOK</text><g clip-path="url(#hook-clip-3)"><text x="20" y="55" fill="#fff" font-size="15">"Stop scrolling. This changed my skin in 7 days."</text></g><rect y="42" width="2" height="15" fill="#f97316" class="cursor-hook-3"><animate attributeName="x" values="20;20;345;345" keyTimes="0;0.1;0.35;1" dur="7s" repeatCount="indefinite" /></rect></g>
    <g transform="translate(70, 140)"><rect width="460" height="84" rx="10" fill="#1c1c1c" stroke="#2a2a2a" stroke-width="1" /><rect width="460" height="84" rx="10" fill="none" stroke-width="2" class="border-body-3" /><text x="20" y="25" fill="#6b7280" font-size="11" font-weight="700" letter-spacing="1">BODY</text><g clip-path="url(#body-clip-3)"><text x="20" y="55" fill="#fff" font-size="15">"Hydra Serum uses clinically-tested peptides that actually penetrate."</text></g><rect y="42" width="2" height="15" fill="#6366f1" class="cursor-body-3"><animate attributeName="x" values="20;20;445;445" keyTimes="0;0.35;0.64;1" dur="7s" repeatCount="indefinite" /></rect></g>
    <g transform="translate(70, 240)"><rect width="460" height="84" rx="10" fill="#1c1c1c" stroke="#2a2a2a" stroke-width="1" /><rect width="460" height="84" rx="10" fill="none" stroke-width="2" class="border-cta-3" /><text x="20" y="25" fill="#6b7280" font-size="11" font-weight="700" letter-spacing="1">CTA</text><g clip-path="url(#cta-clip-3)"><text x="20" y="55" fill="#fff" font-size="15">"Tap below and try it risk-free for 30 days."</text></g><rect y="42" width="2" height="15" fill="#22c55e" class="cursor-cta-3"><animate attributeName="x" values="20;20;315;315" keyTimes="0;0.64;0.88;1" dur="7s" repeatCount="indefinite" /></rect></g>
    <g transform="translate(220, 350)">
      <g class="badge-anim" style="transform-origin: 80px 18px;">
        <rect width="160" height="36" rx="18" fill="#22c55e" />
        <path d="M 25 18 L 33 26 L 48 10" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="60" y="23" fill="#fff" font-size="13" font-weight="700" letter-spacing="0.5">3 segments ready</text>
      </g>
    </g>
  </g>
</svg>`;

const svgSegmentMixer = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" style="display:block;width:100%;height:auto;background-color:#111111;">
  <defs>
    <filter id="glow-4" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="blur" /><feComponentTransfer in="blur" result="fadedBlur"><feFuncA type="linear" slope="0.8" /></feComponentTransfer><feMerge><feMergeNode in="fadedBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
  </defs>
  <style>
    .global-anim-4 { animation: loop-fade-4 6s infinite; }
    @keyframes loop-fade-4 { 0%, 5% { opacity: 0; } 10%, 95% { opacity: 1; } 100% { opacity: 0; } }
    .cell-4 { stroke-width: 1.5px; }
    .cell-text-4 { font-size: 14px; font-weight: 500; text-anchor: middle; alignment-baseline: middle; }
    @keyframes act-ha-4 { 0%, 20%, 90%, 100% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 25%, 74% { stroke: #2a2a2a; fill: #1c1c1c; } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-ha-4 { 0%, 20%, 90%, 100% { fill: #f97316; } 25%, 74% { fill: #6b7280; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-hb-4 { 0%, 20%, 50%, 74%, 90%, 100% { stroke: #2a2a2a; fill: #1c1c1c; } 25%, 45% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-hb-4 { 0%, 20%, 50%, 74%, 90%, 100% { fill: #6b7280; } 25%, 45% { fill: #f97316; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-hc-4 { 0%, 45%, 74%, 90%, 100% { stroke: #2a2a2a; fill: #1c1c1c; } 50%, 70% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-hc-4 { 0%, 45%, 74%, 90%, 100% { fill: #6b7280; } 50%, 70% { fill: #f97316; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-ba-4 { 0%, 45%, 90%, 100% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 50%, 74% { stroke: #2a2a2a; fill: #1c1c1c; } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-ba-4 { 0%, 45%, 90%, 100% { fill: #f97316; } 50%, 74% { fill: #6b7280; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-bb-4 { 0%, 45%, 74%, 90%, 100% { stroke: #2a2a2a; fill: #1c1c1c; } 50%, 70% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-bb-4 { 0%, 45%, 74%, 90%, 100% { fill: #6b7280; } 50%, 70% { fill: #f97316; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-bc-4 { 0%, 74%, 90%, 100% { stroke: #2a2a2a; fill: #1c1c1c; } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-bc-4 { 0%, 74%, 90%, 100% { fill: #6b7280; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-ca-4 { 0%, 20%, 50%, 70%, 90%, 100% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 25%, 45%, 74% { stroke: #2a2a2a; fill: #1c1c1c; } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-ca-4 { 0%, 20%, 50%, 70%, 90%, 100% { fill: #f97316; } 25%, 45%, 74% { fill: #6b7280; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-cb-4 { 0%, 74%, 90%, 100% { stroke: #2a2a2a; fill: #1c1c1c; } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-cb-4 { 0%, 74%, 90%, 100% { fill: #6b7280; } 75%, 85% { fill: #ffffff; } }
    @keyframes act-cc-4 { 0%, 20%, 50%, 74%, 90%, 100% { stroke: #2a2a2a; fill: #1c1c1c; } 25%, 45% { stroke: #f97316; fill: rgba(249,115,22,0.08); } 75%, 85% { stroke: #f97316; fill: rgba(249,115,22,0.2); } }
    @keyframes text-cc-4 { 0%, 20%, 50%, 74%, 90%, 100% { fill: #6b7280; } 25%, 45% { fill: #f97316; } 75%, 85% { fill: #ffffff; } }
    .c-ha-4 { animation: act-ha-4 6s infinite; } .t-ha-4 { animation: text-ha-4 6s infinite; }
    .c-hb-4 { animation: act-hb-4 6s infinite; } .t-hb-4 { animation: text-hb-4 6s infinite; }
    .c-hc-4 { animation: act-hc-4 6s infinite; } .t-hc-4 { animation: text-hc-4 6s infinite; }
    .c-ba-4 { animation: act-ba-4 6s infinite; } .t-ba-4 { animation: text-ba-4 6s infinite; }
    .c-bb-4 { animation: act-bb-4 6s infinite; } .t-bb-4 { animation: text-bb-4 6s infinite; }
    .c-bc-4 { animation: act-bc-4 6s infinite; } .t-bc-4 { animation: text-bc-4 6s infinite; }
    .c-ca-4 { animation: act-ca-4 6s infinite; } .t-ca-4 { animation: text-ca-4 6s infinite; }
    .c-cb-4 { animation: act-cb-4 6s infinite; } .t-cb-4 { animation: text-cb-4 6s infinite; }
    .c-cc-4 { animation: act-cc-4 6s infinite; } .t-cc-4 { animation: text-cc-4 6s infinite; }
    .conn-4 { fill: none; stroke: #f97316; stroke-width: 2.5; stroke-dasharray: 6 6; animation: march-4 0.5s linear infinite; }
    @keyframes march-4 { from { stroke-dashoffset: 12; } to { stroke-dashoffset: 0; } }
    @keyframes p1-fade-4 { 0%, 20%, 90%, 100% { opacity: 1; } 21%, 89% { opacity: 0; } }
    @keyframes p2-fade-4 { 0%, 24%, 46%, 100% { opacity: 0; } 25%, 45% { opacity: 1; } }
    @keyframes p3-fade-4 { 0%, 49%, 71%, 100% { opacity: 0; } 50%, 70% { opacity: 1; } }
    .path-1-4 { animation: p1-fade-4 6s infinite; }
    .path-2-4 { animation: p2-fade-4 6s infinite; }
    .path-3-4 { animation: p3-fade-4 6s infinite; }
  </style>
  <g class="global-anim-4">
    <text x="110" y="50" fill="#6b7280" font-size="12" font-weight="700" letter-spacing="1" text-anchor="middle">HOOKS</text>
    <text x="300" y="50" fill="#6b7280" font-size="12" font-weight="700" letter-spacing="1" text-anchor="middle">BODIES</text>
    <text x="490" y="50" fill="#6b7280" font-size="12" font-weight="700" letter-spacing="1" text-anchor="middle">CTAS</text>
    <g opacity="0.7">
      <path class="conn-4 path-1-4" d="M 180 120 C 205 120, 205 120, 230 120 M 370 120 C 395 120, 395 120, 420 120" />
      <path class="conn-4 path-2-4" d="M 180 230 C 205 230, 205 120, 230 120 M 370 120 C 395 120, 395 340, 420 340" />
      <path class="conn-4 path-3-4" d="M 180 340 C 205 340, 205 230, 230 230 M 370 230 C 395 230, 395 120, 420 120" />
    </g>
    <g transform="translate(40, 90)"><rect width="140" height="60" rx="10" class="cell-4 c-ha-4" /><text x="70" y="31" class="cell-text-4 t-ha-4">Hook A</text></g>
    <g transform="translate(40, 200)"><rect width="140" height="60" rx="10" class="cell-4 c-hb-4" /><text x="70" y="31" class="cell-text-4 t-hb-4">Hook B</text></g>
    <g transform="translate(40, 310)"><rect width="140" height="60" rx="10" class="cell-4 c-hc-4" /><text x="70" y="31" class="cell-text-4 t-hc-4">Hook C</text></g>
    <g transform="translate(230, 90)"><rect width="140" height="60" rx="10" class="cell-4 c-ba-4" /><text x="70" y="31" class="cell-text-4 t-ba-4">Body A</text></g>
    <g transform="translate(230, 200)"><rect width="140" height="60" rx="10" class="cell-4 c-bb-4" /><text x="70" y="31" class="cell-text-4 t-bb-4">Body B</text></g>
    <g transform="translate(230, 310)"><rect width="140" height="60" rx="10" class="cell-4 c-bc-4" /><text x="70" y="31" class="cell-text-4 t-bc-4">Body C</text></g>
    <g transform="translate(420, 90)"><rect width="140" height="60" rx="10" class="cell-4 c-ca-4" /><text x="70" y="31" class="cell-text-4 t-ca-4">CTA A</text></g>
    <g transform="translate(420, 200)"><rect width="140" height="60" rx="10" class="cell-4 c-cb-4" /><text x="70" y="31" class="cell-text-4 t-cb-4">CTA B</text></g>
    <g transform="translate(420, 310)"><rect width="140" height="60" rx="10" class="cell-4 c-cc-4" /><text x="70" y="31" class="cell-text-4 t-cc-4">CTA C</text></g>
  </g>
</svg>`;

/* -------------------------------------------------------------------------- */
/*  Animation wrapper components                                               */
/* -------------------------------------------------------------------------- */

function AnimationProductImport() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-zinc-800"
      dangerouslySetInnerHTML={{ __html: svgProductImport }}
    />
  );
}

function AnimationPersonaBuilder() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-zinc-800"
      dangerouslySetInnerHTML={{ __html: svgPersonaBuilder }}
    />
  );
}

function AnimationVideoGeneration() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-zinc-800"
      dangerouslySetInnerHTML={{ __html: svgVideoGeneration }}
    />
  );
}

function AnimationSegmentMixer() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden border border-zinc-800"
      dangerouslySetInnerHTML={{ __html: svgSegmentMixer }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Features data                                                              */
/* -------------------------------------------------------------------------- */

const features = [
  {
    title: "Zero-Input Product Import",
    description:
      "Paste any store URL and we pull products, images, prices, and descriptions automatically. No CSV uploads, no data entry.",
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
    title: "AI Persona Builder",
    description:
      "Design a virtual spokesperson with 9 brand attributes. Tone, energy, style, age, saved and reused across every campaign.",
    subtext: "Create unlimited personas per brand.",
    bullets: [
      "9 configurable persona attributes",
      "Consistent brand identity across ads",
      "Multiple personas per brand",
    ],
    mock: <AnimationPersonaBuilder />,
    reversed: true,
  },
  {
    title: "Smart Video Generation",
    description:
      "AI writes Hook/Body/CTA scripts tailored to your product and persona. Each segment is generated as a short, crisp video clip.",
    subtext: "Under 10s per segment for perfect lip-sync.",
    bullets: [
      "AI-generated scripts per product",
      "Hook, Body & CTA structure built-in",
      "Single or 3x batch generation",
    ],
    mock: <AnimationVideoGeneration />,
    reversed: false,
  },
  {
    title: "Segment Mixer",
    description:
      "Mix and match 3 hooks, 3 bodies, and 3 CTAs to produce up to 27 unique video combinations from a single generation.",
    subtext: "A/B test at scale without extra cost.",
    bullets: [
      "27 unique ad combinations per batch",
      "Download individual segments",
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
              {feature.subtext && (
                <p className="text-primary text-sm font-medium">
                  {feature.subtext}
                </p>
              )}
              <ul className="space-y-3">
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

            {/* Animation */}
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
