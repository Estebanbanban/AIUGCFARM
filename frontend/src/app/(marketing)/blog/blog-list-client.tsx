"use client";

import { motion } from "framer-motion";
import { BlogCard, BlogCategories, BlogNewsletter } from "@/components/blog";
import { staggerContainer, fadeInUp } from "@/lib/animations";
import type { BlogPost } from "@/lib/blog-types";

interface BlogListClientProps {
  posts: BlogPost[];
}

export function BlogListClient({ posts }: BlogListClientProps) {
  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-16 sm:px-6">
      {/* Hero */}
      <motion.div {...fadeInUp} className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
          The CineRads Blog
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Expert tips on UGC video ads, e-commerce growth, AI marketing, and
          tutorials to help you create better ads and scale faster.
        </p>
      </motion.div>

      {/* Categories */}
      <div className="mb-10">
        <BlogCategories active="all" />
      </div>

      {posts.length === 0 ? (
        <p className="text-center text-muted-foreground py-16">
          No articles yet. Check back soon!
        </p>
      ) : (
        <>
          {/* Featured */}
          {featured && (
            <div className="mb-10">
              <BlogCard post={featured} featured />
            </div>
          )}

          {/* Grid */}
          {rest.length > 0 && (
            <motion.div
              {...staggerContainer}
              initial="initial"
              whileInView="animate"
              viewport={{ once: true }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {rest.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </motion.div>
          )}

          {/* Newsletter */}
          <BlogNewsletter />
        </>
      )}
    </div>
  );
}
