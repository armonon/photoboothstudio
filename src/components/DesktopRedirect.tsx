"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The bundled desktop app opens the landing page (index.html); send it straight to
// the tool. On the web the marketing landing stays.
export default function DesktopRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      router.replace("/remove");
    }
  }, [router]);
  return null;
}
