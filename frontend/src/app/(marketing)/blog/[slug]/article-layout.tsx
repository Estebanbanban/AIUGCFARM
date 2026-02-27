"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BlogHeader,
  BlogAuthor,
  BlogToc,
  BlogRelated,
  BlogNewsletter,
} from "@/components/blog";
import { fadeInUp } from "@/lib/animations";
import type { BlogPost } from "@/lib/blog-types";

interface ArticleLayoutProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
  children: ReactNode;
}

export function ArticleLayout({ post, relatedPosts, children }: ArticleLayoutProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-16 sm:px-6">
      <motion.div {...fadeInUp}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12">
          {/* Main content */}
          <article className="max-w-3xl">
            <BlogHeader post={post} />
            {children}
            <BlogAuthor name={post.author} />
          </article>

          {/* Sidebar */}
          <BlogToc />
        </div>

        <BlogRelated posts={relatedPosts} />
        <BlogNewsletter />
      </motion.div>
    </div>
  );
}
