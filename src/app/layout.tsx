import "./globals.css";
import type { Metadata, Viewport } from "next";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = {
  title: "Model Studio",
  description: "Upload garment photos and turn them into clean product mockups — free background removal + optional AI.",
  applicationName: "Model Studio",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Model Studio" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
