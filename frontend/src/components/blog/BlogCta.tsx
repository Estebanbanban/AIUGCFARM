import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface BlogCtaProps {
  title?: string;
  description?: string;
  buttonText?: string;
  buttonHref?: string;
}

export function BlogCta({
  title = "Ready to create scroll-stopping video ads?",
  description = "Turn any product URL into high-converting UGC video ads in minutes with CineRads.",
  buttonText = "Start Free Trial",
  buttonHref = "/sign-up",
}: BlogCtaProps) {
  return (
    <div className="my-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      <Button asChild>
        <Link href={buttonHref}>
          {buttonText}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
