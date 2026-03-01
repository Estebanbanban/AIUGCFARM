import { Badge } from "@/components/ui/badge";
import { CATEGORIES, type BlogPost } from "@/lib/blog-types";
import { formatDate } from "@/lib/utils";
import { Clock, Calendar } from "lucide-react";

interface BlogHeaderProps {
  post: BlogPost;
}

export function BlogHeader({ post }: BlogHeaderProps) {
  return (
    <header className="mb-10">
      <div className="flex items-center gap-3 mb-4">
        <Badge variant="accent">
          {CATEGORIES[post.category]?.label ?? post.category}
        </Badge>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="size-3.5" />
          {formatDate(post.date)}
        </span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="size-3.5" />
          {post.readingTime}
        </span>
      </div>

      <h1 className="text-4xl font-bold tracking-tight mb-4">
        {post.title}
      </h1>

      <p className="text-xl text-muted-foreground leading-relaxed">
        {post.description}
      </p>

      <div className="mt-6 pt-6 border-t border-border">
        <p className="text-sm text-muted-foreground">
          By <span className="font-medium text-foreground">{post.author}</span>
        </p>
      </div>
    </header>
  );
}
