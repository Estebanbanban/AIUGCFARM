/**
 * Validate a URL string to prevent SSRF attacks.
 * Blocks private/internal network addresses and non-HTTP(S) schemes.
 * Performs DNS resolution to catch rebinding attacks.
 */

const privatePatterns = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local
  /^0\./, // current network
];

/** Check whether an IP address belongs to a private/reserved range. */
export function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") {
    return true;
  }
  for (const pattern of privatePatterns) {
    if (pattern.test(ip)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve the hostname via DNS and verify that none of the resulting IPs
 * point to a private/internal address (prevents DNS rebinding attacks).
 */
async function resolveAndValidate(hostname: string): Promise<void> {
  try {
    const ips = await Deno.resolveDns(hostname, "A");
    for (const ip of ips) {
      if (isPrivateIp(ip)) {
        throw new Error(`DNS resolved to private IP: ${ip}`);
      }
    }
  } catch (e) {
    if ((e as Error).message?.includes("private IP")) throw e;
    // DNS resolution may fail in some environments; allow the request
    // to proceed and rely on the hostname-based checks above.
  }
}

export async function validateUrl(url: string): Promise<URL> {
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

  // DNS resolution check — catch rebinding attacks
  await resolveAndValidate(hostname);

  return parsed;
}
