import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cn, formatCurrency, formatDate, absoluteUrl } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    const result = cn("px-2", "px-4");
    expect(result).toBe("px-4");
  });

  it("handles conditional classes", () => {
    const result = cn("base", false && "hidden", "visible");
    expect(result).toBe("base visible");
  });

  it("returns empty string for no input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(25)).toBe("$25.00");
  });

  it("formats cents correctly", () => {
    expect(formatCurrency(0.95)).toBe("$0.95");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    // Use ISO format with time to avoid timezone offset issues
    const result = formatDate("2025-01-15T12:00:00");
    expect(result).toBe("Jan 15, 2025");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date(2025, 5, 1)); // June 1, 2025
    expect(result).toBe("Jun 1, 2025");
  });
});

describe("absoluteUrl", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_APP_URL;
    }
  });

  it("prepends app URL to path", () => {
    expect(absoluteUrl("/dashboard")).toBe("https://example.com/dashboard");
  });

  it("handles root path", () => {
    expect(absoluteUrl("/")).toBe("https://example.com/");
  });
});
