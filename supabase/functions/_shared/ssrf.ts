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

/**
 * Parse the numeric value of the first group of a colon-separated IPv6 address.
 * The input should be the expanded or compressed IPv6 string (without brackets).
 */
function ipv6FirstGroupValue(ip: string): number {
  const firstGroup = ip.split(":")[0];
  return parseInt(firstGroup || "0", 16);
}

/** Check whether an IP address belongs to a private/reserved range. */
export function isPrivateIp(ip: string): boolean {
  // IPv4 loopback / unspecified
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0:0:0:0:0:0:0:1" || ip === "0.0.0.0") {
    return true;
  }

  // IPv4 private ranges
  for (const pattern of privatePatterns) {
    if (pattern.test(ip)) {
      return true;
    }
  }

  // IPv6 checks
  const lower = ip.toLowerCase();

  // IPv4-mapped IPv6 (::ffff:x.x.x.x or ::ffff:hex)
  if (lower.startsWith("::ffff:")) {
    // The suffix may be a dotted-decimal IPv4 or a hex pair — treat the whole
    // address as potentially private since it maps to an IPv4 address.
    const suffix = lower.slice(7); // e.g. "192.168.1.1" or "c0a8:0101"
    // If it looks like dotted-decimal, check it directly
    if (/^\d+\.\d+\.\d+\.\d+$/.test(suffix)) {
      return isPrivateIp(suffix);
    }
    // Otherwise conservatively treat all ::ffff: addresses as needing a check;
    // any ::ffff: address could map to a private IPv4 range.
    return true;
  }

  // fc00::/7 — Unique Local (fc00:: through fdff::)
  // First group starts with fc or fd
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }

  // fe80::/10 — Link-local (fe80:: through febf::)
  // First group fe80–febf
  if (lower.startsWith("fe")) {
    const firstGroup = ipv6FirstGroupValue(lower);
    if (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve the hostname via DNS and verify that none of the resulting IPs
 * point to a private/internal address (prevents DNS rebinding attacks).
 * Queries both A (IPv4) and AAAA (IPv6) records.
 * Fails closed: any DNS resolution error blocks the request.
 */
async function resolveAndValidate(hostname: string): Promise<void> {
  let ipv4s: string[] = [];
  let ipv6s: string[] = [];

  const [ipv4Result, ipv6Result] = await Promise.allSettled([
    Deno.resolveDns(hostname, "A"),
    Deno.resolveDns(hostname, "AAAA"),
  ]);

  // Fail closed: if either DNS query fails, block the request entirely.
  // This prevents DNS rebinding attacks where resolution succeeds at check
  // time but the TTL expires before the TCP connection is made.
  if (ipv4Result.status === "rejected") {
    throw new Error(
      `DNS resolution failed for hostname: ${(ipv4Result.reason as Error).message ?? ipv4Result.reason}`,
    );
  }
  if (ipv6Result.status === "rejected") {
    throw new Error(
      `DNS resolution failed for hostname: ${(ipv6Result.reason as Error).message ?? ipv6Result.reason}`,
    );
  }

  ipv4s = ipv4Result.value;
  ipv6s = ipv6Result.value;

  for (const ip of [...ipv4s, ...ipv6s]) {
    if (isPrivateIp(ip)) {
      throw new Error(`DNS resolved to private IP: ${ip}`);
    }
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
    throw new Error("Invalid URL scheme  -  only http and https are allowed");
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

  // Block bracketed IPv6 private ranges in the hostname field
  // e.g. [fc00::1], [fd12::1], [fe80::1]–[febf::1]
  if (hostname.startsWith("[")) {
    const inner = hostname.slice(1, hostname.length - 1); // strip [ ]
    if (
      inner.startsWith("fc") ||
      inner.startsWith("fd") ||
      inner.startsWith("fe8") ||
      inner.startsWith("fe9") ||
      inner.startsWith("fea") ||
      inner.startsWith("feb") ||
      inner.startsWith("::ffff:")
    ) {
      throw new Error("URL targets a private IPv6 network address");
    }
  }

  // DNS resolution check  -  catch rebinding attacks (fail closed)
  await resolveAndValidate(hostname);

  return parsed;
}
