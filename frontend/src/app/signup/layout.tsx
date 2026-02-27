import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started — CineRads",
  description: "Create your free CineRads account and start generating AI-powered UGC video ads.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
