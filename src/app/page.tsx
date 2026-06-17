import Link from "next/link";
import Enhancer from "@/components/Enhancer";
import { getProducts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Model Studio</h1>
      <p className="mt-1 text-neutral-400">
        Upload a garment photo and turn it into a perfect product mockup.
      </p>

      <div className="mt-6">
        <Enhancer />
      </div>

      {products.length > 0 && (
        <details className="mt-10 border-t border-neutral-800 pt-6">
          <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-300">
            Or use the deterministic print studio
          </summary>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {products.map((p) => (
              <li key={p.id} className="rounded-lg border border-neutral-800 p-4">
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-neutral-400">
                  {p.type} &middot; {p.fitStyle}
                </div>
                <Link
                  href={`/studio/${p.id}`}
                  className="mt-3 inline-block rounded bg-white px-3 py-1.5 text-sm font-medium text-black"
                >
                  Open in print studio
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
