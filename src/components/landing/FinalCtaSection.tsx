import { UrlInputCta } from "./UrlInputCta";

export function FinalCtaSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[400px] rounded-full bg-violet-500/10 blur-[80px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
          Ready to Scale Your Ad Creative?
        </h2>
        <p className="mt-6 text-lg text-zinc-400">
          Join 500+ brands creating UGC video ads with AI.
        </p>

        <div className="mx-auto mt-10 max-w-xl">
          <UrlInputCta />
        </div>
      </div>
    </section>
  );
}
