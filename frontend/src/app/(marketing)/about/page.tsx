import type { Metadata } from "next";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "About — CineRads",
  description:
    "CineRads is on a mission to make professional UGC video ads accessible to every e-commerce brand, without creators, studios, or waiting.",
};

export default function AboutPage() {
  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="px-4 pt-40 pb-20 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-4">
            Our story
          </p>
          <h1 className="text-[clamp(2.5rem,5vw,4rem)] font-bold tracking-tight text-foreground leading-[1.1]">
            We're building the creative
            <br />
            <span className="text-primary">engine for DTC brands.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            CineRads was built by two founders who got tired of watching great products
            lose to mediocre ads. So we fixed it.
          </p>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Mission */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
              The problem
            </p>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              UGC shouldn&apos;t cost $500 and two weeks.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Traditional UGC creators charge $150–$500 per video, take 1–2 weeks to
              deliver, and go off-brief half the time. For a DTC brand running 20+
              creatives a month, that&apos;s a full-time budget just for content.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3">
              Our answer
            </p>
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              AI that generates on-brand video ads in minutes.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Paste your product URL, build your AI persona, and generate 27 unique
              TikTok and Meta ad variations in under 10 minutes — at a fraction of
              the cost.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Founders */}
      <section className="px-4 py-20 sm:px-6 bg-card/30">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3 text-center">
            The team
          </p>
          <h2 className="text-2xl font-semibold text-foreground mb-10 text-center">
            Built by founders, for founders.
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                name: "Esteban",
                role: "Co-founder",
                bio: "Serial builder with a background in growth and e-commerce. Has scaled multiple DTC brands and knows firsthand how expensive creative production gets at scale.",
              },
              {
                name: "Antoine",
                role: "Co-founder",
                bio: "Full-stack engineer and product designer. Obsessed with turning complex AI pipelines into tools that feel effortless for non-technical users.",
              },
            ].map((founder) => (
              <div
                key={founder.name}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg mb-4">
                  {founder.name[0]}
                </div>
                <p className="font-semibold text-foreground">{founder.name}</p>
                <p className="text-xs text-primary mb-3">{founder.role}, CineRads</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {founder.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Values */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3 text-center">
            What we believe
          </p>
          <h2 className="text-2xl font-semibold text-foreground mb-10 text-center">
            Our principles
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                title: "Speed over perfection",
                body: "The best creative team in the world is the one that can test 50 hooks a week. Volume wins.",
              },
              {
                title: "Radical transparency",
                body: "Clear pricing. No hidden fees. No lock-in. We earn your trust every month.",
              },
              {
                title: "Builders first",
                body: "We're a small team moving fast. Every feature we ship is something we'd use ourselves.",
              },
            ].map((v) => (
              <div key={v.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="size-1.5 rounded-full bg-primary mb-4" />
                <p className="font-semibold text-foreground mb-2">{v.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-6 border-t border-border">
        <div className="mx-auto max-w-xl text-center">
          <Logo variant="icon" size="lg" />
          <h2 className="mt-6 text-2xl font-semibold text-foreground">
            Ready to 10x your ad creative output?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start free — no credit card required.
          </p>
          <a
            href="/signup"
            className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Get started free →
          </a>
        </div>
      </section>
    </div>
  );
}
