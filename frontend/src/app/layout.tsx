import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CineRads, AI UGC Video Ads for E-Commerce",
  description:
    "Turn any product URL into scroll-stopping UGC video ads in minutes. AI-powered personas, hook/body/CTA structure optimized for TikTok, Instagram Reels & Meta Ads.",
  keywords: [
    "UGC video ads",
    "AI video generator",
    "e-commerce ads",
    "TikTok ads",
    "Meta ads",
    "product video ads",
    "UGC creator",
    "AI ad generator",
  ],
  openGraph: {
    title: "CineRads, AI UGC Video Ads for E-Commerce",
    description:
      "Turn any product URL into scroll-stopping UGC video ads in minutes. AI-powered personas, hook/body/CTA structure optimized for TikTok, Instagram Reels & Meta Ads.",
    type: "website",
    siteName: "CineRads",
  },
  twitter: {
    card: "summary_large_image",
    title: "CineRads, AI UGC Video Ads for E-Commerce",
    description:
      "Turn any product URL into scroll-stopping UGC video ads in minutes. AI-powered personas, hook/body/CTA structure optimized for TikTok, Instagram Reels & Meta Ads.",
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
