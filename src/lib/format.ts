export function formatCrore(value: number, currency: "INR" | "USD" = "INR"): string {
  if (currency === "USD") {
    // Illustrative conversion only.
    const usd = value * 1e7 * 0.12;
    return `~$${Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(usd)}`;
  }
  return `₹${value.toLocaleString("en-IN")} cr`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-IN");
}

export function formatCompact(n: number): string {
  return Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return iso;
  const diff = Date.now() - d;
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
