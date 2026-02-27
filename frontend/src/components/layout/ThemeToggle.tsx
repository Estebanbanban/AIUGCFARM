"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";

  function handleToggle() {
    setTheme(nextTheme);
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label={`Switch to ${nextTheme} mode`}
      onClick={handleToggle}
      title={isDark ? "Dark mode" : "Light mode"}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
