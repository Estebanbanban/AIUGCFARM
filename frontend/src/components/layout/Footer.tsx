import Link from "next/link";

const footerLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "mailto:support@cinerads.com" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Link href="/" className="text-lg font-bold tracking-tight text-white">
            CineRads
          </Link>
          <p className="text-xs text-zinc-500">
            Built with AI. Designed for conversion.
          </p>
        </div>

        {/* Links */}
        <nav className="flex items-center gap-6">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} CineRads. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
