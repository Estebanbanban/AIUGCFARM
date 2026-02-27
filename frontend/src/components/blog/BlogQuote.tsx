interface BlogQuoteProps {
  children: React.ReactNode;
  attribution?: string;
}

export function BlogQuote({ children, attribution }: BlogQuoteProps) {
  return (
    <figure className="my-8 border-l-3 border-primary bg-primary/5 rounded-r-lg p-6">
      <blockquote className="text-xl italic leading-relaxed text-foreground">
        {children}
      </blockquote>
      {attribution && (
        <figcaption className="mt-3 text-sm text-muted-foreground">
          &mdash; {attribution}
        </figcaption>
      )}
    </figure>
  );
}
