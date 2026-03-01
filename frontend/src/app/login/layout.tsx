import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In, CineRads",
  description: "Sign in to your CineRads account to create AI-powered UGC video ads.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
