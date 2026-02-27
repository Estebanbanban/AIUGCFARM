import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getAllCategories,
  getPostsByCategory,
  CATEGORIES,
  type BlogCategory,
} from "@/lib/blog";
import { CategoryClient } from "./category-client";

interface Props {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES[category as BlogCategory];
  if (!cat) return {};

  return {
    title: `${cat.label} — CineRads Blog`,
    description: cat.description,
    openGraph: {
      title: `${cat.label} — CineRads Blog`,
      description: cat.description,
      type: "website",
      siteName: "CineRads",
    },
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = CATEGORIES[category as BlogCategory];
  if (!cat) notFound();

  const posts = getPostsByCategory(category as BlogCategory);

  return (
    <CategoryClient
      category={category as BlogCategory}
      label={cat.label}
      description={cat.description}
      posts={posts}
    />
  );
}
