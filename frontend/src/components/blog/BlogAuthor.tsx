interface BlogAuthorProps {
  name?: string;
}

export function BlogAuthor({ name = "CineRads Team" }: BlogAuthorProps) {
  return (
    <div className="flex items-center gap-4 py-6 my-8 border-t border-b border-border">
      <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
        {name.charAt(0)}
      </div>
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">
          Sharing insights on UGC video ads and AI-powered marketing.
        </p>
      </div>
    </div>
  );
}
