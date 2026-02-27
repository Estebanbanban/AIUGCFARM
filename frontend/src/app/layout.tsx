import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CineRads — AI UGC Video Ad Generator for Shopify & DTC Brands",
  description:
    "The AI UGC video generator for e-commerce brands. Turn any Shopify or product URL into 27 unique TikTok and Meta ad creatives in under 10 minutes. No creators. No editing. Start free.",
  keywords: [
    "UGC video generator",
    "AI UGC video ad generator",
    "UGC video maker online",
    "AI ad maker for Shopify",
    "TikTok ad creator AI",
    "AI-generated video ads",
    "e-commerce video ads",
    "UGC creator tool",
    "automated video ads",
    "Meta ads generator",
    "product video ads",
    "AI video generator for DTC",
  ],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "CineRads — AI UGC Video Ad Generator for Shopify & DTC Brands",
    description:
      "The AI UGC video generator for e-commerce brands. Turn any Shopify or product URL into 27 unique TikTok and Meta ad creatives in under 10 minutes. No creators. No editing. Start free.",
    type: "website",
    siteName: "CineRads",
  },
  twitter: {
    card: "summary_large_image",
    title: "CineRads — AI UGC Video Ad Generator for Shopify & DTC Brands",
    description:
      "The AI UGC video generator for e-commerce brands. Turn any Shopify or product URL into 27 unique TikTok and Meta ad creatives in under 10 minutes. No creators. No editing. Start free.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background text-foreground antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="cinerads-theme"
        >
          <QueryProvider>
            {children}
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
