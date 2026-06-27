export function getApiUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const fallbackUrl = process.env.NODE_ENV === "production" ? "https://api.taxilao.com" : "http://localhost:4000";

  return (configuredUrl || fallbackUrl).replace(/\/$/, "");
}
