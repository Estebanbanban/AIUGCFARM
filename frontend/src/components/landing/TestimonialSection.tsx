"use client";

import { FadeInUp } from "@/lib/motion";

export function TestimonialSection() {
  return (
    <section className="bg-[#050505] py-24 px-4 sm:px-6 border-y border-[#111]">
      <div className="max-w-3xl mx-auto text-center">
        <FadeInUp>
          <span className="text-7xl text-primary/50 font-serif leading-none block mb-6">&ldquo;</span>
          <blockquote className="text-2xl md:text-3xl font-serif font-medium text-white italic leading-relaxed">
            We built Cinerads because we were spending $500+ per UGC video and
            waiting days for each one. Now we generate 27 variations in under 10
            minutes.
          </blockquote>
          <div className="mt-8">
            <p className="text-sm font-semibold text-white">Esteban &amp; Antoine</p>
            <p className="text-sm text-[#888] mt-1">Founders, Cinerads</p>
          </div>
        </FadeInUp>
      </div>
    </section>
  );
}
