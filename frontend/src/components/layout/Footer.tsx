import Link from "next/link";

const links = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Blog", href: "/blog" },
    { label: "FAQ", href: "#faq" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "mailto:hello@cinerads.com" },
  ],
  Legal: [
    { label: "Terms", href: "#" },
    { label: "Privacy", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-background-secondary px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
              CineRads
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              AI-generated UGC video ads for e-commerce brands.
            </p>
          </div>

          {Object.entries(links).map(([col, items]) => (
            <div key={col}>
              <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
                {col}
              </p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-8">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} CineRads. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
