export function getApiUrl() {
  if (process.env.NODE_ENV === "production") {
    return "https://api.taxilao.com";
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  return (configuredUrl || "http://localhost:4000").replace(/\/$/, "");
}

// Rewrite any API-served media URL (relative or any host) to the API host this
// admin is configured to talk to. Keeps data: and external URLs untouched.
export function resolveMedia(url?: string | null): string {
  if (!url) return "";
  const value = String(url);
  if (value.startsWith("data:")) return value;
  const idx = value.indexOf("/uploads/");
  if (idx >= 0) return `${getApiUrl()}${value.slice(idx)}`;
  return value;
}
