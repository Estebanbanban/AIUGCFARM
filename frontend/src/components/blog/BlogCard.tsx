"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, type BlogPost } from "@/lib/blog-types";
import { fadeInUp } from "@/lib/animations";
import { Clock, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  return (
    <motion.article {...fadeInUp}>
      <Link
        href={`/blog/${post.slug}`}
        className={`group block overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-lg hover:border-primary/20 ${
          featured ? "md:grid md:grid-cols-2 md:gap-0" : ""
        }`}
      >
        <div
          className={`relative overflow-hidden ${
            featured ? "aspect-[16/9] md:aspect-auto md:h-full" : "aspect-[16/9]"
          }`}
        >
          <Image
            src={post.image}
            alt={post.imageAlt}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes={featured ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"}
          />
        </div>

        <div className={`flex flex-col gap-3 p-5 ${featured ? "md:p-8 md:justify-center" : ""}`}>
          <div className="flex items-center gap-3">
            <Badge variant="accent" className="text-xs">
              {CATEGORIES[post.category]?.label ?? post.category}
            </Badge>
          </div>

          <h3
            className={`font-semibold leading-snug group-hover:text-primary transition-colors ${
              featured ? "text-2xl md:text-3xl" : "text-lg"
            }`}
          >
            {post.title}
          </h3>

          <p
            className={`text-muted-foreground line-clamp-2 ${
              featured ? "text-base" : "text-sm"
            }`}
          >
            {post.description}
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {formatDate(post.date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {post.readingTime}
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
