import { UrlInputCta } from "./UrlInputCta";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Gradient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-violet-600/20 blur-[128px]" />
        <div className="absolute top-1/3 left-1/3 h-[400px] w-[400px] rounded-full bg-violet-500/10 blur-[96px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
          <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
          AI-Powered UGC Video Ads
        </div>

        {/* Headline */}
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Turn Your Store Into a{" "}
          <span className="bg-gradient-to-r from-violet-400 to-violet-600 bg-clip-text text-transparent">
            UGC Ad Factory
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 md:text-xl">
          Paste your URL. Build an AI persona. Generate scroll-stopping video ads
          in minutes — not days.
        </p>

        {/* CTA */}
        <div className="mx-auto mt-10 max-w-xl">
          <UrlInputCta />
        </div>

        {/* Social proof */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="flex -space-x-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="size-8 rounded-full border-2 border-zinc-950 bg-gradient-to-br from-violet-400 to-zinc-600"
                style={{
                  opacity: 1 - i * 0.12,
                }}
              />
            ))}
          </div>
          <p className="text-sm text-zinc-500">
            Trusted by{" "}
            <span className="text-zinc-300 font-medium">500+</span> e-commerce
            brands
          </p>
        </div>
      </div>
    </section>
  );
}
