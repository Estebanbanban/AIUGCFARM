import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";

export type { BlogCategory, BlogPost } from "./blog-types";
export { CATEGORIES } from "./blog-types";

import type { BlogCategory, BlogPost } from "./blog-types";
import { CATEGORIES } from "./blog-types";

const BLOG_DIR = path.join(process.cwd(), "src/content/blog");

function parseMdxFile(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const source = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(source);
  const stats = readingTime(content);

  return {
    slug,
    title: data.title ?? "",
    description: data.description ?? "",
    date: data.date ?? "",
    category: data.category ?? "ugc-video",
    tags: data.tags ?? [],
    image: data.image ?? "/blog/placeholder.jpg",
    imageAlt: data.imageAlt ?? data.title ?? "",
    author: data.author ?? "CineRads Team",
    readingTime: stats.text,
    content,
    published: data.published !== false,
  };
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => parseMdxFile(file.replace(/\.mdx$/, "")))
    .filter((post): post is BlogPost => post !== null && post.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  return parseMdxFile(slug);
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((post) => post.category === category);
}

export function getRelatedPosts(
  currentSlug: string,
  limit = 3
): BlogPost[] {
  const current = getPostBySlug(currentSlug);
  if (!current) return [];

  const allPosts = getAllPosts().filter((p) => p.slug !== currentSlug);

  // Prioritize same category, then shared tags
  const scored = allPosts.map((post) => {
    let score = 0;
    if (post.category === current.category) score += 3;
    const sharedTags = post.tags.filter((t) => current.tags.includes(t));
    score += sharedTags.length;
    return { post, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.post);
}

export function getAllCategories(): BlogCategory[] {
  return Object.keys(CATEGORIES) as BlogCategory[];
}

export function getAllTags(): string[] {
  const tags = new Set<string>();
  getAllPosts().forEach((post) => post.tags.forEach((t) => tags.add(t)));
  return Array.from(tags).sort();
}
