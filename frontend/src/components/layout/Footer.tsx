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
    <footer className="bg-[#050505] border-t border-[#1a1a1a] py-16 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-lg font-bold text-white tracking-tight">
              CineRads
            </Link>
            <p className="text-sm text-[#555] leading-relaxed mt-2">
              AI-generated UGC video ads for e-commerce brands.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([col, items]) => (
            <div key={col}>
              <p className="text-xs uppercase tracking-widest text-[#444] mb-4">{col}</p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-[#666] hover:text-white transition-colors duration-200"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#111] pt-8">
          <p className="text-xs text-[#444]">
            &copy; {new Date().getFullYear()} CineRads. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
