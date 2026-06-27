export function getApiUrl() {
  if (process.env.NODE_ENV === "production") {
    return "https://api.taxilao.com";
  }

  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  return (configuredUrl || "http://localhost:4000").replace(/\/$/, "");
}
