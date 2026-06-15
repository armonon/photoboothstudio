import Link from "next/link";
import { mockProducts } from "@/lib/mock-data";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Model Studio</h1>
      <p className="mt-1 text-neutral-400">Pick a product to open in the studio.</p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {mockProducts.map((p) => (
          <li key={p.id} className="rounded-lg border border-neutral-800 p-4">
            <div className="font-medium">{p.name}</div>
            <div className="text-sm text-neutral-400">
              {p.type} &middot; {p.fitStyle}
            </div>
            <Link
              href={`/studio/${p.id}`}
              className="mt-3 inline-block rounded bg-white px-3 py-1.5 text-sm font-medium text-black"
            >
              Open in Model Studio
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
