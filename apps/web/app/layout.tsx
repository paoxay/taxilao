import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "TAXILAO.COM | Premium Drivers in Laos",
  description: "Book verified premium taxi drivers and private tours across Laos."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo">
      <body>{children}</body>
    </html>
  );
}
