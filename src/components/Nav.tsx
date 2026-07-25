"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import Logo from "@/components/Logo";

const tabs = [
  { href: "/remove", label: "Remove Background" },
  { href: "/studio", label: "Studio" },
  { href: "/download", label: "Download" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800/80 bg-neutral-950/70 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-5 py-2.5 text-sm">
        <Link href="/" className="mr-2 rounded-md px-1 py-1 hover:opacity-90" aria-label="Model Studio home">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {tabs.map((t) => {
            const active = path === t.href || (t.href !== "/" && path?.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={clsx(
                  "rounded-md px-3 py-1.5",
                  active ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200",
                )}
              >
                {t.label}
              </Link>
            );
          })}
          <Link href="/remove" className="ml-2 rounded-md bg-white px-3 py-1.5 font-medium text-black hover:bg-neutral-200">
            Open app
          </Link>
        </div>
      </nav>
    </header>
  );
}
