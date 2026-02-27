import { HeroSection } from "@/components/landing/HeroSection";
import { VideoCarousel } from "@/components/landing/VideoCarousel";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { MetricsBar } from "@/components/landing/MetricsBar";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "CineRads",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Turn any product URL into scroll-stopping UGC video ads in minutes. AI-powered personas, hook/body/CTA structure optimized for TikTok, Instagram Reels & Meta Ads.",
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "29",
          priceCurrency: "USD",
          description: "5 video credits per month, 1 AI persona, 720p exports",
        },
        {
          "@type": "Offer",
          name: "Growth",
          price: "79",
          priceCurrency: "USD",
          description:
            "25 video credits per month, unlimited personas, 1080p exports",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is a video credit?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "One credit generates one full video ad with 3 segments (Hook, Body, CTA). You can mix segments from a single credit into up to 27 unique combinations.",
          },
        },
        {
          "@type": "Question",
          name: "Which platforms are the videos optimized for?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Videos are optimized for TikTok, Meta (Facebook & Instagram Reels), and YouTube Shorts. All exports are 9:16 vertical format at up to 1080p.",
          },
        },
        {
          "@type": "Question",
          name: "How long does it take to generate a video?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Most videos are generated in under 10 minutes. Complex batches may take slightly longer. You'll get an email notification when your video is ready.",
          },
        },
        {
          "@type": "Question",
          name: "Can I write my own scripts?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. You can use our AI-generated scripts or write and upload your own. You have full control over the Hook, Body, and CTA copy.",
          },
        },
        {
          "@type": "Question",
          name: "Which stores are supported?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "We support any public product URL, including Shopify, WooCommerce, BigCommerce, Amazon, and standalone product pages.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a free trial?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Every new account gets 1 free video credit - no credit card required. Generate a full video ad and see the quality before you commit.",
          },
        },
        {
          "@type": "Question",
          name: "Can I cancel anytime?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Absolutely. There are no contracts or cancellation fees. You can cancel your subscription at any time from your account settings.",
          },
        },
        {
          "@type": "Question",
          name: "Who owns the generated content?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You do. All videos generated on CineRads are yours to use commercially without restriction. We retain no rights to your content.",
          },
        },
      ],
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroSection />
      <VideoCarousel />
      <MetricsBar />
      <HowItWorksSection />
      <FeaturesSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
