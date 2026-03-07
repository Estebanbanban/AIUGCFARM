"use client";

import { useState } from "react";
import { Lightbulb, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

const EDGE_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface FormState {
  email: string;
  title: string;
  problem: string;
  useCase: string;
  context: string;
}

const EMPTY: FormState = {
  email: "",
  title: "",
  problem: "",
  useCase: "",
  context: "",
};

export function FeatureIdeasForm() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${EDGE_URL}/submit-feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          type: "feature",
          title: form.title,
          description: form.problem,
          email: form.email || undefined,
          metadata: {
            use_case: form.useCase || undefined,
            context: form.context || undefined,
          },
        }),
      });

      if (!res.ok) {
        let detail = `Error ${res.status}`;
        try {
          const json = await res.json();
          if (json?.detail) detail = String(json.detail);
        } catch { /* ignore */ }
        setError(detail);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Failed to send idea. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-10 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-7 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Idea submitted - thank you!</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
          Your idea has been sent directly to the CineRads product team. We read every submission.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
          <Zap className="size-3.5" />
          If your idea ships, 5 free credits will be added to your account.
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => { setForm(EMPTY); setSubmitted(false); }}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
          >
            Submit another idea
          </button>
          <span className="text-muted-foreground/30">·</span>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Credits incentive banner */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/8 px-4 py-3">
        <Zap className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Earn 5 free credits.</span>{" "}
          If your idea makes it into the product, we&apos;ll credit your account manually. No action needed on your end.
        </p>
      </div>

      {/* Title */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Feature title <span className="text-primary">*</span>
        </label>
        <input
          type="text"
          required
          value={form.title}
          onChange={set("title")}
          placeholder="e.g. Batch download all video combos as ZIP"
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {/* Problem */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          What problem does it solve? <span className="text-primary">*</span>
        </label>
        <textarea
          required
          rows={3}
          value={form.problem}
          onChange={set("problem")}
          placeholder="Describe the frustration or limitation you're running into today."
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {/* Use case */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Who would benefit & how often?
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional but very helpful)</span>
        </label>
        <textarea
          rows={3}
          value={form.useCase}
          onChange={set("useCase")}
          placeholder="e.g. Every brand owner running multiple products would use this daily to save time downloading."
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {/* Additional context */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Anything else?
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={form.context}
          onChange={set("context")}
          placeholder="References, mockups, similar tools you've seen, etc."
          className="w-full resize-none rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {/* Email */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Your email
          <span className="ml-1.5 text-xs text-muted-foreground font-normal">(so we can notify you when it ships + credit you)</span>
        </label>
        <input
          type="email"
          value={form.email}
          onChange={set("email")}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Lightbulb className="size-4" />
        {isSubmitting ? "Sending…" : "Submit Feature Idea"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Your idea is sent directly to our team.
      </p>
    </form>
  );
}
