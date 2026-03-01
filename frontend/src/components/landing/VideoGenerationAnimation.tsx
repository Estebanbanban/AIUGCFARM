// SVG animation for the "How It Works" step 3 - shows the video generation
// loading sequence with 4 morphing scenes (graphs, checkout, printing money, viral).
// Rendered via dangerouslySetInnerHTML to preserve CSS class-based animations
// exactly as authored in SVG/CSS without JSX attribute conversion.

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420" style="display:block;width:100%;height:auto;background-color:#f8fafc;">
  <defs>
    <filter id="shadow-light-5" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.05" />
    </filter>
    <filter id="heart-glow-5" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#ef4444" flood-opacity="0.4" />
    </filter>
    <linearGradient id="graph-area-5" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f97316" stop-opacity="0.2" />
      <stop offset="100%" stop-color="#f97316" stop-opacity="0" />
    </linearGradient>
    <clipPath id="graph-clip-5">
      <rect x="50" y="0" height="200" width="0" class="graph-clip" />
    </clipPath>
  </defs>

  <style>
    .spin-5 { animation: spinner-5 2s linear infinite; transform-origin: 160px 72px; }
    @keyframes spinner-5 { 100% { transform: rotate(360deg); } }

    .s1-fade-5 { animation: sc1 8s cubic-bezier(0.4,0,0.2,1) infinite; transform-origin: center; }
    .s2-fade-5 { animation: sc2 8s cubic-bezier(0.4,0,0.2,1) infinite; transform-origin: center; }
    .s3-fade-5 { animation: sc3 8s cubic-bezier(0.4,0,0.2,1) infinite; transform-origin: center; }
    .s4-fade-5 { animation: sc4 8s cubic-bezier(0.4,0,0.2,1) infinite; transform-origin: center; }

    @keyframes sc1 { 0%,22%{opacity:1;transform:scale(1)} 25%,100%{opacity:0;transform:scale(0.95)} }
    @keyframes sc2 { 0%,22%{opacity:0;transform:scale(0.95)} 25%,47%{opacity:1;transform:scale(1)} 50%,100%{opacity:0;transform:scale(0.95)} }
    @keyframes sc3 { 0%,47%{opacity:0;transform:scale(0.95)} 50%,72%{opacity:1;transform:scale(1)} 75%,100%{opacity:0;transform:scale(0.95)} }
    @keyframes sc4 { 0%,72%{opacity:0;transform:scale(0.95)} 75%,97%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0.95)} }

    .graph-clip { animation: gc 8s infinite; }
    @keyframes gc { 0%,5%{width:0} 15%,25%{width:220px} 26%,100%{width:0} }

    .item1 { animation: i1 8s cubic-bezier(0.5,0,0.8,1) infinite; }
    .item2 { animation: i2 8s cubic-bezier(0.5,0,0.8,1) infinite; }
    .item3 { animation: i3 8s cubic-bezier(0.5,0,0.8,1) infinite; }
    @keyframes i1 { 0%,25%{transform:translate(110px,20px) rotate(-20deg) scale(0);opacity:0} 28%,48%{transform:translate(110px,95px) rotate(10deg) scale(1);opacity:1} 50%,100%{opacity:0} }
    @keyframes i2 { 0%,28%{transform:translate(145px,10px) rotate(15deg) scale(0);opacity:0} 31%,48%{transform:translate(145px,90px) rotate(-5deg) scale(1);opacity:1} 50%,100%{opacity:0} }
    @keyframes i3 { 0%,31%{transform:translate(175px,30px) rotate(-45deg) scale(0);opacity:0} 34%,48%{transform:translate(175px,105px) rotate(0deg) scale(1);opacity:1} 50%,100%{opacity:0} }

    .bill1 { animation: b1 8s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin: center; }
    .bill2 { animation: b2 8s cubic-bezier(0.34,1.56,0.64,1) infinite; transform-origin: center; }
    @keyframes b1 { 0%,50%{transform:translate(150px,140px) rotate(0deg) scale(0.8);opacity:0} 52%,73%{transform:translate(150px,140px) rotate(12deg) scale(1);opacity:1} 75%,100%{opacity:0} }
    @keyframes b2 { 0%,52%{transform:translate(140px,150px) rotate(0deg) scale(0.8);opacity:0} 54%,73%{transform:translate(140px,150px) rotate(-5deg) scale(1);opacity:1} 75%,100%{opacity:0} }

    .viral-heart { animation: vh 8s cubic-bezier(0.17,0.89,0.32,1.28) infinite; transform-origin: 200px 110px; }
    @keyframes vh { 0%,75%{transform:scale(0);opacity:0} 77%{transform:scale(1.1);opacity:1} 80%{transform:scale(0.9)} 83%{transform:scale(1.2)} 86%,95%{transform:scale(1);opacity:1} 98%,100%{transform:scale(0);opacity:0} }
  </style>

  <!-- Title + spinner + progress bar -->
  <g>
    <g class="spin-5">
      <circle cx="160" cy="72" r="10" fill="none" stroke="#e2e8f0" stroke-width="3" />
      <path d="M 160 62 A 10 10 0 0 1 170 72" fill="none" stroke="#f97316" stroke-width="3" stroke-linecap="round" />
    </g>
    <text x="300" y="80" fill="#111827" font-size="24" font-weight="800" text-anchor="middle">Generating Video</text>
    <rect x="200" y="100" width="200" height="8" rx="4" fill="#e2e8f0" />
    <rect x="200" y="100" height="8" rx="4" fill="#f97316">
      <animate attributeName="width" values="0;200;0" keyTimes="0;0.98;1" dur="8s" repeatCount="indefinite" />
    </rect>
  </g>

  <!-- Morphing scene container -->
  <g transform="translate(150,140)">
    <rect width="300" height="200" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" filter="url(#shadow-light-5)" />
    <path d="M 40 140 L 260 140 M 40 110 L 260 110 M 40 80 L 260 80" stroke="#f1f5f9" stroke-width="2" stroke-dasharray="4 4" />

    <!-- Scene 1: Making graphs go up -->
    <g class="s1-fade-5">
      <text x="150" y="40" fill="#6b7280" font-size="14" font-weight="600" text-anchor="middle">Making graphs go up...</text>
      <g clip-path="url(#graph-clip-5)">
        <path d="M 60 160 L 90 140 L 130 150 L 170 90 L 200 105 L 240 60 L 240 180 L 60 180 Z" fill="url(#graph-area-5)" />
        <path d="M 60 160 L 90 140 L 130 150 L 170 90 L 200 105 L 240 60" fill="none" stroke="#f97316" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="240" cy="60" r="6" fill="#ffffff" stroke="#f97316" stroke-width="3" />
      </g>
    </g>

    <!-- Scene 2: Stuffing the checkout -->
    <g class="s2-fade-5">
      <text x="150" y="40" fill="#6b7280" font-size="14" font-weight="600" text-anchor="middle">Stuffing the checkout...</text>
      <g class="item1"><rect x="-15" y="-15" width="30" height="30" rx="6" fill="#f97316" /><path d="M -5 -5 L 5 5 M -5 5 L 5 -5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.5"/></g>
      <g class="item2"><rect x="-12" y="-12" width="24" height="24" rx="4" fill="#6366f1" /><circle cx="0" cy="0" r="4" fill="#ffffff" opacity="0.5" /></g>
      <g class="item3"><rect x="-15" y="-8" width="30" height="16" rx="8" fill="#10b981" /></g>
      <g transform="translate(45,15)">
        <path d="M 20 45 L 45 45 L 65 120 L 175 120" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 60 100 L 175 100 L 190 50 L 46 50 Z" fill="none" stroke="#111827" stroke-width="5" stroke-linejoin="round" />
        <line x1="85" y1="50" x2="80" y2="100" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
        <line x1="125" y1="50" x2="120" y2="100" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
        <line x1="165" y1="50" x2="160" y2="100" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
        <line x1="53" y1="75" x2="182" y2="75" stroke="#111827" stroke-width="4" stroke-linecap="round"/>
        <circle cx="80" cy="140" r="10" fill="#111827" /><circle cx="155" cy="140" r="10" fill="#111827" />
        <circle cx="80" cy="140" r="4" fill="#ffffff" /><circle cx="155" cy="140" r="4" fill="#ffffff" />
      </g>
    </g>

    <!-- Scene 3: Printing money -->
    <g class="s3-fade-5">
      <text x="150" y="40" fill="#6b7280" font-size="14" font-weight="600" text-anchor="middle">Printing money...</text>
      <g class="bill1">
        <rect x="-60" y="-30" width="120" height="60" rx="6" fill="#86efac" stroke="#15803d" stroke-width="3" />
        <rect x="-50" y="-22" width="100" height="44" rx="2" fill="none" stroke="#15803d" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="0" cy="0" r="14" fill="#15803d" />
      </g>
      <g class="bill2">
        <rect x="-60" y="-30" width="120" height="60" rx="6" fill="#dcfce7" stroke="#16a34a" stroke-width="4" />
        <rect x="-50" y="-22" width="100" height="44" rx="2" fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="4 4"/>
        <ellipse cx="0" cy="0" rx="18" ry="12" fill="none" stroke="#16a34a" stroke-width="3" />
        <path d="M -40 -12 L -30 -12 M 30 -12 L 40 -12 M -40 12 L -30 12 M 30 12 L 40 12" stroke="#16a34a" stroke-width="2" stroke-linecap="round"/>
        <text x="0" y="6" fill="#16a34a" font-size="18" font-weight="900" text-anchor="middle">$</text>
      </g>
    </g>

    <!-- Scene 4: Going viral -->
    <g class="s4-fade-5">
      <text x="150" y="40" fill="#6b7280" font-size="14" font-weight="600" text-anchor="middle">Going viral...</text>
      <g transform="translate(60,60)">
        <rect x="0" y="0" width="70" height="110" rx="8" fill="#ffffff" stroke="#111827" stroke-width="4" />
        <line x1="25" y1="10" x2="45" y2="10" stroke="#111827" stroke-width="3" stroke-linecap="round" />
        <path d="M 28 45 L 48 55 L 28 65 Z" fill="#f97316" stroke="#f97316" stroke-width="3" stroke-linejoin="round" />
      </g>
      <g transform="translate(200,110)" class="viral-heart">
        <path d="M 0 10 C -20 -10,-40 10,-40 30 C -40 50,0 80,0 80 C 0 80,40 50,40 30 C 40 10,20 -10,0 10 Z" fill="#ef4444" filter="url(#heart-glow-5)" />
      </g>
    </g>
  </g>
</svg>`;

export function VideoGenerationAnimation() {
  return (
    <div
      className="w-full overflow-hidden rounded-xl"
      dangerouslySetInnerHTML={{ __html: SVG }}
    />
  );
}
