"use client";

import { motion } from "framer-motion";
import { BlogCard } from "./BlogCard";
import { staggerContainer } from "@/lib/animations";
import type { BlogPost } from "@/lib/blog-types";

interface BlogRelatedProps {
  posts: BlogPost[];
}

export function BlogRelated({ posts }: BlogRelatedProps) {
  if (posts.length === 0) return null;

  return (
    <section className="my-16">
      <h2 className="text-2xl font-semibold mb-6">Related Articles</h2>
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
    </section>
  );
}
