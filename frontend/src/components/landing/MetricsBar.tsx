"use client";

const logoNames = [
  "zumper",
  "kit.sch",
  "drift",
  "SCENTBIRD",
  "BOMBAS",
  "MaryRuth's",
  "BIOMA",
  "ELEVATE",
  "BINANCE",
  "Weee!",
  "COMCAST",
  "APPLOVIN",
  "Alibaba.com",
  "ByteDance",
];

const metrics = [
  { value: "20M+", label: "Ads analyzed" },
  { value: "10M+", label: "Ads created" },
  { value: "$650M+", label: "Ad spend" },
];

export function MetricsBar() {
  return (
    <section className="bg-background pb-16 pt-8 md:pb-24 md:pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-[clamp(1.25rem,2.2vw,2rem)] font-medium tracking-tight text-foreground">
          Trusted by growing ecommerce brands and performance teams
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 md:mt-10 md:grid-cols-7 md:gap-y-7">
          {logoNames.map((name) => (
            <div key={name} className="text-center text-sm font-semibold tracking-wide text-muted-foreground md:text-base">
              {name}
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_14px_36px_rgba(0,0,0,0.1)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.3)] md:mt-14">
          <div className="grid md:grid-cols-3">
            {metrics.map((m, i) => (
              <div
                key={m.label}
                className={`px-6 py-10 text-center md:px-8 md:py-12 ${
                  i > 0 ? "border-t border-border md:border-l md:border-t-0" : ""
                }`}
              >
                <p className="text-5xl font-semibold tracking-tight text-primary md:text-6xl">{m.value}</p>
                <p className="mt-3 text-[clamp(1rem,1.9vw,1.9rem)] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
