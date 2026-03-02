import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { Footer } from "@/components/layout/Footer";
import { FirstVideoDiscountBanner } from "@/components/landing/FirstVideoDiscountBanner";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <FirstVideoDiscountBanner />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
