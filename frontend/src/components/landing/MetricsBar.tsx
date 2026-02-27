"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";

function useCountUp(target: number, duration = 2000, inView = false) {
  const [count, setCount] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [inView, target, duration]);

  return count;
}

const stats = [
  { value: 500, suffix: "+", prefix: "", label: "Brands" },
  { value: 10000, suffix: "+", prefix: "", label: "Videos Generated" },
  { value: 10, suffix: " Min", prefix: "< ", label: "Per Video" },
  { value: 27, suffix: "", prefix: "", label: "Combos Per Batch" },
];

function StatItem({
  stat,
  inView,
}: {
  stat: (typeof stats)[number];
  inView: boolean;
}) {
  const count = useCountUp(stat.value, 2000, inView);
  const formatted =
    stat.value >= 10000 ? count.toLocaleString() : count.toString();

  return (
    <div className="text-center flex-1 py-4">
      <p className="text-3xl md:text-4xl font-bold font-mono">
        {stat.prefix}
        {formatted}
        {stat.suffix}
      </p>
      <p className="text-sm text-white/60 mt-1">{stat.label}</p>
    </div>
  );
}

export function MetricsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-foreground text-background">
      <motion.div
        {...fadeInUp}
        whileInView={fadeInUp.animate}
        viewport={{ once: true }}
        className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-20"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
          {stats.map((stat) => (
            <StatItem key={stat.label} stat={stat} inView={inView} />
          ))}
        </div>
      </motion.div>
    </section>
  );
}
