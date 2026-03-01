"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";

export function BlogNewsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with newsletter API
    setSubmitted(true);
  };

  return (
    <section className="bg-muted/50 border border-border rounded-2xl p-8 my-12">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">Stay up to date</h3>
      </div>
      <p className="text-muted-foreground mb-6">
        Get the latest tips on UGC video ads, e-commerce growth, and AI
        marketing delivered to your inbox.
      </p>

      {submitted ? (
        <p className="text-sm font-medium text-primary">
          Thanks for subscribing! Check your inbox to confirm.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-md">
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Button type="submit" className="shrink-0">
            Subscribe
          </Button>
        </form>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        No spam. Unsubscribe anytime.
      </p>
    </section>
  );
}
