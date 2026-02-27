"use client";

import { CountUp, FadeInUp } from "@/lib/motion";

const metrics = [
  { value: 500, suffix: "+", label: "Brands", sub: "trust us" },
  { value: 10000, suffix: "+", label: "Videos", sub: "generated" },
  { value: 10, suffix: " min", label: "Per Video", sub: "avg. turnaround" },
  { value: 27, suffix: "", label: "Combos", sub: "per batch" },
];

export function MetricsBar() {
  return (
    <section className="bg-black py-20 border-y border-[#111]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          {metrics.map((m, i) => (
            <FadeInUp key={m.label} delay={i * 0.1}>
              <div
                className={`flex flex-col items-center py-6 ${
                  i % 2 !== 0 ? "border-l border-[#1a1a1a]" : ""
                } ${i >= 2 ? "border-t md:border-t-0 border-[#1a1a1a]" : ""} ${
                  i > 0 ? "md:border-l" : ""
                }`}
              >
                <div className="text-5xl font-bold font-mono text-white tabular-nums">
                  <CountUp target={m.value} suffix={m.suffix} />
                </div>
                <p className="text-sm font-medium text-white mt-1">{m.label}</p>
                <p className="text-xs text-[#555] mt-0.5">{m.sub}</p>
              </div>
            </FadeInUp>
          ))}
        </div>
      </div>
    </section>
  );
}
