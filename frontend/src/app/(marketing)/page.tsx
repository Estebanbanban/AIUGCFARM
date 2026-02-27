"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { ScrapeResults } from "@/components/products/scrape-results";
import type { ScrapeResponseData } from "@/types/api";

export default function LandingPage() {
  const router = useRouter();
  const [scrapeData, setScrapeData] = useState<ScrapeResponseData | null>(null);

  return (
    <>
      <HeroSection onScrapeComplete={setScrapeData} />
      {scrapeData && (
        <section className="relative py-12 md:py-20 border-t border-white/5">
          <ScrapeResults
            data={scrapeData}
            isAuthenticated={false}
            onSignUpClick={() => {
              localStorage.setItem("pendingScrapeData", JSON.stringify(scrapeData));
              router.push("/signup");
            }}
            onRetry={() => setScrapeData(null)}
          />
        </section>
      )}
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
