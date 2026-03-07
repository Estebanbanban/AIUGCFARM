"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
}

export function BlogToc() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll(".blog-prose h2")
    );
    const items = elements.map((el) => ({
      id: el.id,
      text: el.textContent ?? "",
    }));
    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 space-y-6">
        <nav>
          <p className="text-sm font-medium mb-3">On this page</p>
          <ul className="space-y-2 text-sm">
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  href={`#${heading.id}`}
                  className={cn(
                    "block text-muted-foreground transition-colors hover:text-foreground",
                    activeId === heading.id &&
                      "text-primary font-medium"
                  )}
                >
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="rounded-xl border border-border p-4 bg-muted/30">
          <p className="text-sm font-medium mb-1">Try CineRads Free</p>
          <p className="text-xs text-muted-foreground mb-3">
            Create your first AI video ad in minutes.
          </p>
          <Button asChild size="sm" className="w-full">
            <Link href="/sign-up">
              Get Started
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </aside>
  );
}
