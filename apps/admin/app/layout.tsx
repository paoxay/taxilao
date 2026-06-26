import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "TAXILAO Admin | ຫຼັງບ້ານ",
  description: "ລະບົບຫຼັງບ້ານສຳລັບ TAXILAO.COM"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lo">
      <body>{children}</body>
    </html>
  );
}
