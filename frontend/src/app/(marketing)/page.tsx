import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/HeroSection";
import { VideoCarousel } from "@/components/landing/VideoCarousel";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { MetricsBar } from "@/components/landing/MetricsBar";
import { TestimonialSection } from "@/components/landing/TestimonialSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";

export const metadata: Metadata = {
  title: "CineRads - AI UGC Video Ads for E-Commerce",
  description:
    "Create AI-powered UGC video ads in minutes. Import your products, build AI personas, and generate short-form video ads for TikTok, Reels, and Shorts.",
  openGraph: {
    title: "CineRads - AI UGC Video Ads for E-Commerce",
    description: "Create AI-powered UGC video ads in minutes.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "CineRads",
      url: "https://cinerads.com",
      description: "AI-powered UGC video ad generator for e-commerce brands",
      logo: "https://cinerads.com/og-logo.png",
      sameAs: [],
    },
    {
      "@type": "SoftwareApplication",
      name: "CineRads",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "The AI UGC video generator for e-commerce brands. Turn any Shopify or product URL into 27 unique TikTok and Meta ad creatives in under 10 minutes.",
      offers: [
        {
          "@type": "Offer",
          name: "Starter",
          price: "25",
          priceCurrency: "USD",
          description:
            "Up to 81 unique video ads per month, 2 AI personas/month, 1 brand · 5 products/brand, 720p exports, AI-Written Scripts",
        },
        {
          "@type": "Offer",
          name: "Growth",
          price: "80",
          priceCurrency: "USD",
          description:
            "Up to 270 unique video ads per month, 10 AI personas/month, 3 brands · 20 products/brand, 1080p exports, Custom Script Editor, 10% off credit packs",
        },
        {
          "@type": "Offer",
          name: "Scale",
          price: "180",
          priceCurrency: "USD",
          description:
            "Up to 810 unique video ads per month, 100 AI personas/month, unlimited brands and products, 1080p exports, 20% off credit packs, priority support",
        },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is a segment credit?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "One segment credit generates one video clip: either a Hook (3–5s), Body (5–10s), or CTA (3–5s). With 9 segments (3 of each type), you can mix and match 27 unique full-length video ads. Combining segments is always free.",
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
            text: "Yes. All plans include AI-Written Scripts. Growth and Scale plans also include the Custom Script Editor: write or edit your own Hook, Body, and CTA copy before generation.",
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
            text: "Brand import and AI persona creation are completely free - no credit card required. Import your brand, build your AI persona, and explore the platform before generating your first video.",
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
        {
          "@type": "Question",
          name: "Do you offer a refund?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes: if your first generation isn't what you expected, we offer a 7-day money-back guarantee. No questions asked.",
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
      <HowItWorksSection />
      <FeaturesSection />
      <MetricsBar />
      <TestimonialSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </>
  );
}
