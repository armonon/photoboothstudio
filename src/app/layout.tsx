import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Model Studio",
  description: "Deterministic garment mockups — pixel-exact prints, zero per-product cost.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  );
}
