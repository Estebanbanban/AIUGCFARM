import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import { BlogListClient } from "./blog-list-client";

export const metadata: Metadata = {
  title: "Blog — CineRads | UGC Video Ads & E-Commerce Marketing Tips",
  description:
    "Expert tips on UGC video ads, e-commerce growth strategies, AI marketing, and step-by-step tutorials to scale your online store with video.",
  openGraph: {
    title: "Blog — CineRads | UGC Video Ads & E-Commerce Marketing Tips",
    description:
      "Expert tips on UGC video ads, e-commerce growth strategies, AI marketing, and step-by-step tutorials to scale your online store with video.",
    type: "website",
    siteName: "CineRads",
  },
};

export default function BlogPage() {
  const posts = getAllPosts();

  return <BlogListClient posts={posts} />;
}
