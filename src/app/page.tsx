import Enhancer from "@/components/Enhancer";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Remove Background</h1>
      <p className="mt-1 text-neutral-400">
        Upload garment photos and get clean cutouts — free, offline. Hit <span className="text-sky-300">Edit</span> on any
        result to fix the selection by hand.
      </p>
      <div className="mt-6">
        <Enhancer mode="free" />
      </div>
    </main>
  );
}
