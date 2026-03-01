"use client";

interface LogoProps {
  variant?: "full" | "icon" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl";
  theme?: "dark" | "light" | "auto";
  className?: string;
}

const sizeMap = {
  sm: { icon: 24, text: "text-base", gap: "gap-2" },
  md: { icon: 32, text: "text-lg", gap: "gap-2.5" },
  lg: { icon: 40, text: "text-xl", gap: "gap-3" },
  xl: { icon: 56, text: "text-3xl", gap: "gap-4" },
};

function ClapIcon({ size }: { size: number }) {
  const s = size / 64;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="14" fill="#111111" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" stroke="#222222" />
      <rect
        x="14"
        y="15"
        width="36"
        height="8"
        rx="2"
        fill="#F97316"
        transform="rotate(-8 14 15)"
      />
      <rect
        x="22"
        y="13"
        width="4"
        height="10"
        rx="1"
        fill="#111111"
        transform="rotate(-8 22 13)"
      />
      <rect
        x="32"
        y="12"
        width="4"
        height="10"
        rx="1"
        fill="#111111"
        transform="rotate(-8 32 12)"
      />
      <rect
        x="42"
        y="11"
        width="4"
        height="10"
        rx="1"
        fill="#111111"
        transform="rotate(-8 42 11)"
      />
      <rect x="14" y="26" width="36" height="22" rx="3" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo({
  variant = "full",
  size = "md",
  theme = "dark",
  className = "",
}: LogoProps) {
  const { icon, text, gap } = sizeMap[size];
  const textColor =
    theme === "auto"
      ? "text-foreground"
      : theme === "dark"
        ? "text-white"
        : "text-black";

  if (variant === "icon") {
    return <ClapIcon size={icon} />;
  }

  if (variant === "wordmark") {
    return (
      <span
        className={`font-bold tracking-[-0.03em] ${text} ${textColor} ${className}`}
      >
        Cinerads
      </span>
    );
  }

  return (
    <span className={`flex items-center ${gap} ${className}`}>
      <ClapIcon size={icon} />
      <span
        className={`font-bold tracking-[-0.03em] ${text} ${textColor}`}
      >
        Cinerads
      </span>
    </span>
  );
}
