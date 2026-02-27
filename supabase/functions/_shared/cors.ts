function parseAllowedOrigins(): Set<string> {
  const raw = Deno.env.get("ALLOWED_ORIGIN")?.trim();
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean),
  );
}

export function getCorsHeaders(req: Request): HeadersInit {
  const requestOrigin = req.headers.get("origin")?.trim().replace(/\/+$/, "");
  const allowedOrigins = parseAllowedOrigins();

  // If ALLOWED_ORIGIN is set, only allow those origins.
  // If unset, reflect the request origin (browser-safe with credentials), fallback to *.
  let allowOrigin = "*";
  if (allowedOrigins.size > 0) {
    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else {
      allowOrigin = [...allowedOrigins][0]!;
    }
  } else if (requestOrigin) {
    allowOrigin = requestOrigin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    ...(allowOrigin === "*" ? {} : { "Access-Control-Allow-Credentials": "true" }),
  };
}
