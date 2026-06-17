import Enhancer from "@/components/Enhancer";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Model Studio</h1>
      <p className="mt-1 text-neutral-400">
        Upload garment photos and turn them into clean product mockups.
      </p>
      <div className="mt-6">
        <Enhancer />
      </div>
    </main>
  );
}
