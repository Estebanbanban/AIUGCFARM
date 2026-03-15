"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";

export function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const res = await fetch(`${supabaseUrl}/functions/v1/join-waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ email, phone: phone || undefined }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to join waitlist");
      }

      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <section className="bg-background py-24 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-lg text-center"
      >
        <h2 className="text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-tight text-foreground">
          Join the Waitlist
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Be the first to create viral slideshows when we launch. Early access + lifetime discount.
        </p>

        {status === "success" ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="size-7 text-green-500" />
            </div>
            <p className="text-lg font-medium text-foreground">You&apos;re on the list!</p>
            <p className="text-sm text-muted-foreground">We&apos;ll notify you as soon as we launch.</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-3">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={status === "loading" || !email.includes("@")}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {status === "loading" ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Joining…
                </span>
              ) : (
                "Join the Waitlist"
              )}
            </button>
            {status === "error" && (
              <p className="text-sm text-red-500">{errorMsg}</p>
            )}
            <p className="text-xs text-muted-foreground">No spam. Unsubscribe anytime.</p>
          </form>
        )}
      </motion.div>
    </section>
  );
}
