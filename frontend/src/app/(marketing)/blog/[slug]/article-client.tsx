"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  BlogHeader,
  BlogContent,
  BlogAuthor,
  BlogToc,
  BlogRelated,
  BlogNewsletter,
  BlogCta,
  BlogImage,
  BlogQuote,
  BlogComparison,
  BlogMetrics,
} from "@/components/blog";
import { fadeInUp } from "@/lib/animations";
import type { BlogPost } from "@/lib/blog-types";

interface ArticleClientProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
  slug: string;
}

const mdxComponents = {
  BlogCta,
  BlogImage,
  BlogQuote,
  BlogComparison,
  BlogMetrics,
};

export function ArticleClient({ post, relatedPosts, slug }: ArticleClientProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MDXContent = dynamic<any>(
    () => import(`@/content/blog/${slug}.mdx`),
    { loading: () => <div className="animate-pulse h-96 bg-muted/50 rounded-xl" /> }
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-32 pb-16 sm:px-6">
      <motion.div {...fadeInUp}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-12">
          {/* Main content */}
          <article className="max-w-3xl">
            <BlogHeader post={post} />

            <BlogContent>
              <MDXContent components={mdxComponents} />
            </BlogContent>

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
