import { type ReactNode } from "react";

interface BlogContentProps {
  children: ReactNode;
}

export function BlogContent({ children }: BlogContentProps) {
  return (
    <div className="blog-prose">
      {children}
      <style>{`
        .blog-prose h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-top: 3rem;
          margin-bottom: 1rem;
          line-height: 1.3;
          scroll-margin-top: 5rem;
        }
        .blog-prose h3 {
          font-size: 1.25rem;
          font-weight: 500;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          line-height: 1.4;
          scroll-margin-top: 5rem;
        }
        .blog-prose p {
          font-size: 1.125rem;
          line-height: 1.75;
          color: var(--color-muted-foreground);
          margin-bottom: 1.5rem;
        }
        .blog-prose a {
          color: var(--color-primary);
          text-decoration: none;
        }
        .blog-prose a:hover {
          text-decoration: underline;
        }
        .blog-prose blockquote {
          border-left: 3px solid var(--color-primary);
          background: oklch(0.702 0.183 54.37 / 0.05);
          padding: 1rem 1.25rem;
          border-radius: 0 0.5rem 0.5rem 0;
          margin: 1.5rem 0;
        }
        .blog-prose blockquote p {
          margin-bottom: 0;
        }
        .blog-prose ul, .blog-prose ol {
          font-size: 1.125rem;
          line-height: 1.75;
          color: var(--color-muted-foreground);
          padding-left: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .blog-prose li {
          margin-bottom: 0.5rem;
        }
        .blog-prose ul li::marker {
          color: var(--color-primary);
        }
        .blog-prose ol li::marker {
          color: var(--color-primary);
          font-weight: 600;
        }
        .blog-prose img {
          width: 100%;
          border-radius: 0.75rem;
          margin: 2rem 0;
        }
        .blog-prose pre {
          background: var(--color-muted);
          border-radius: 0.75rem;
          padding: 1.25rem;
          overflow-x: auto;
          margin: 1.5rem 0;
          font-size: 0.875rem;
        }
        .blog-prose code {
          font-size: 0.875em;
          background: var(--color-muted);
          padding: 0.15em 0.4em;
          border-radius: 0.25rem;
        }
        .blog-prose pre code {
          background: none;
          padding: 0;
        }
        .blog-prose hr {
          border: none;
          border-top: 1px solid var(--color-border);
          margin: 2.5rem 0;
        }
        .blog-prose strong {
          color: var(--color-foreground);
          font-weight: 600;
        }
        .blog-prose table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.95rem;
        }
        .blog-prose th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-weight: 600;
          border-bottom: 2px solid var(--color-border);
        }
        .blog-prose td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-muted-foreground);
        }
      `}</style>
    </div>
  );
}
