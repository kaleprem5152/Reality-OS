/**
 * Validates redirect paths to prevent open redirect vulnerabilities.
 * Only allows relative paths on the same origin (e.g. "/overview", "/projects/PRJ-1001").
 * Rejects external URLs, protocol-relative paths ("//evil.com"), and javascript/data URIs.
 */
export function getSafeRedirectUrl(target: string | null | undefined, fallback = "/overview"): string {
  if (!target || typeof target !== "string") return fallback;
  const trimmed = target.trim();

  // Must begin with single "/" and not followed by another "/" or "\"
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }

  try {
    // Resolve against dummy origin to verify pathname and origin integrity
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return fallback;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
