import { PricingSection } from "@/components/landing/PricingSection";
import { Check, X } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — AI UGC Generator",
  description:
    "Simple, transparent pricing for AI-powered UGC video ad generation. Start free, scale as you grow.",
};

const comparisonRows = [
  { feature: "Segment credits/month", starter: "27", growth: "90" },
  { feature: "AI personas", starter: "1", growth: "3" },
  { feature: "Brand profiles", starter: "1", growth: "3" },
  { feature: "Easy Mode", starter: true, growth: true },
  { feature: "Expert Mode", starter: false, growth: true },
  { feature: "Custom scripts", starter: false, growth: true },
  { feature: "Export resolution", starter: "720p", growth: "1080p" },
  { feature: "Priority queue", starter: false, growth: false },
];

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === "string") {
    return <span className="text-sm text-zinc-300">{value}</span>;
  }
  if (value) {
    return <Check className="mx-auto size-4 text-violet-400" />;
  }
  return <X className="mx-auto size-4 text-zinc-600" />;
}

export default function PricingPage() {
  return (
    <div className="pt-16">
      <PricingSection />

      {/* Comparison table */}
      <section className="pb-20 md:pb-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h3 className="mb-8 text-center text-xl font-semibold text-white">
            Feature Comparison
          </h3>

          <div className="overflow-hidden rounded-xl border border-white/5">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5 bg-zinc-900/50">
                  <th className="px-6 py-4 text-left text-sm font-medium text-zinc-400">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-zinc-400">
                    Starter
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-violet-400">
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparisonRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="transition-colors hover:bg-zinc-900/30"
                  >
                    <td className="px-6 py-4 text-sm text-zinc-300">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.starter} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <CellValue value={row.growth} />
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
