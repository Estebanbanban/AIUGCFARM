import { PricingSection } from "@/components/landing/PricingSection";
import { Check, X } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing, CineRads",
  description:
    "Simple, transparent pricing for AI-powered UGC video ad generation. Start free, scale as you grow.",
};

const comparisonRows = [
  { feature: "Credits/month", starter: "30", growth: "100", scale: "250" },
  { feature: "Standard videos/mo", starter: "6", growth: "20", scale: "50" },
  { feature: "HD videos/mo", starter: "3", growth: "10", scale: "25" },
  { feature: "AI personas", starter: "1", growth: "3", scale: "10" },
  { feature: "Brand profiles", starter: "1", growth: "3", scale: "10" },
  { feature: "AI-Written Scripts", starter: true, growth: true, scale: true },
  { feature: "Custom Script Editor", starter: false, growth: true, scale: true },
  { feature: "Export resolution", starter: "720p", growth: "1080p", scale: "1080p" },
  { feature: "Priority generation", starter: false, growth: true, scale: true },
  { feature: "Priority support", starter: false, growth: false, scale: true },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm text-muted-foreground">{value}</span>;
  }
  if (value) {
    return <Check className="mx-auto size-4 text-primary" />;
  }
  return <X className="mx-auto size-4 text-zinc-600" />;
}

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />

      {/* Comparison table */}
      <section className="pb-20 md:pb-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h3 className="mb-8 text-center text-xl font-semibold text-foreground">
            Feature Comparison
          </h3>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                    Starter
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-primary">
                    Growth
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-muted-foreground">
                    Scale
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparisonRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.starter} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.growth} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.scale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
