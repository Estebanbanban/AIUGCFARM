"use client";

import { motion } from "framer-motion";
import { BlogCard, BlogCategories, BlogNewsletter } from "@/components/blog";
import { staggerContainer, fadeInUp } from "@/lib/animations";
import type { BlogPost, BlogCategory } from "@/lib/blog-types";

interface CategoryClientProps {
  category: BlogCategory;
  label: string;
  description: string;
  posts: BlogPost[];
}

export function CategoryClient({
  category,
  label,
  description,
  posts,
}: CategoryClientProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-16 sm:px-6">
      {/* Hero */}
      <motion.div {...fadeInUp} className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
          {label}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {description}
        </p>
      </motion.div>

      {/* Categories */}
      <div className="mb-10">
        <BlogCategories active={category} />
      </div>

      {posts.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          No articles in this category yet. Check back soon!
        </p>
      ) : (
        <motion.div
          {...staggerContainer}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </motion.div>
      )}

      <BlogNewsletter />
    </div>
  );
}
