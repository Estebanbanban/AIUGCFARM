/**
 * Validate a URL string to prevent SSRF attacks.
 * Blocks private/internal network addresses and non-HTTP(S) schemes.
 */
export function validateUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Malformed URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid URL scheme — only http and https are allowed");
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block loopback
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    throw new Error("URL targets a loopback address");
  }

  // Block private RFC-1918 ranges
  const privatePatterns = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./, // link-local
    /^0\./, // current network
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      throw new Error("URL targets a private network address");
    }
  }

  // Block common internal hostnames
  if (
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".localhost")
  ) {
    throw new Error("URL targets an internal hostname");
  }

  return parsed;
}
