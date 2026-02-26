import { Globe, UserCircle, Video } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Paste Your Store URL",
    description:
      "We scrape your Shopify store and auto-import all product data, images, and descriptions.",
    icon: Globe,
  },
  {
    number: "02",
    title: "Build Your AI Persona",
    description:
      "Create a custom AI spokesperson with our Sims-like character builder. 9 attributes, infinite combinations.",
    icon: UserCircle,
  },
  {
    number: "03",
    title: "Generate & Download",
    description:
      "One click generates 4 video variations with Hook/Body/CTA structure optimized for paid social.",
    icon: Video,
  },
];

export function HowItWorksSection() {
  return (
    <section className="relative py-20 md:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section header */}
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">
            Simple Process
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How It Works
          </h2>
        </div>

        {/* Steps */}
        <div className="relative mt-16 grid gap-8 md:grid-cols-3 md:gap-12">
          {/* Connecting line (desktop only) */}
          <div className="pointer-events-none absolute top-14 left-[16.67%] right-[16.67%] hidden h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent md:block" />

          {steps.map((step) => (
            <div key={step.number} className="relative flex flex-col items-center text-center">
              {/* Number badge + icon */}
              <div className="relative">
                <div className="flex size-28 items-center justify-center rounded-2xl border border-white/5 bg-zinc-900/50">
                  <step.icon className="size-10 text-violet-400" />
                </div>
                <span className="absolute -top-3 -right-3 flex size-8 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {step.number}
                </span>
              </div>

              {/* Content */}
              <h3 className="mt-6 text-lg font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
