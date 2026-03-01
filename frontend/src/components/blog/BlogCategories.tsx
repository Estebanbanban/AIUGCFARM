"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { CATEGORIES, type BlogCategory } from "@/lib/blog-types";

interface BlogCategoriesProps {
  active?: BlogCategory | "all";
}

export function BlogCategories({ active = "all" }: BlogCategoriesProps) {
  const categories = Object.entries(CATEGORIES) as [
    BlogCategory,
    { label: string; description: string },
  ][];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      <Link
        href="/blog"
        className={cn(
          "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
          active === "all"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        )}
      >
        All
      </Link>
      {categories.map(([key, { label }]) => (
        <Link
          key={key}
          href={`/blog/category/${key}`}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
            active === key
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
