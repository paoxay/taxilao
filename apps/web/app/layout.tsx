import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { BottomNav } from "./components";

export const metadata: Metadata = {
  title: "TAXILAO.COM | Premium Drivers in Laos",
  description: "Book verified premium taxi drivers and private tours across Laos."
};

export const viewport: Viewport = {
  themeColor: "#06070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo">
      <body>
        <div className="app-shell">
          <div className="app-content">{children}</div>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
