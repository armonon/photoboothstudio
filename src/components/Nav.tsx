"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { href: "/", label: "Studio" },
  { href: "/download", label: "Download app" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-neutral-800">
      <nav className="mx-auto flex max-w-4xl gap-1 px-8 py-2 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "rounded px-3 py-1.5",
              path === t.href ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
