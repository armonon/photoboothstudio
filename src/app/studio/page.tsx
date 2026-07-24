import LayeredStudio from "@/components/LayeredStudio";

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Studio</h1>
      <p className="mt-1 text-neutral-400">
        Drop or import several photos — each becomes a layer. Arrange them, cut them out by hand (brush, magic wand,
        lasso), then export the flattened PNG.
      </p>
      <div className="mt-5">
        <LayeredStudio />
      </div>
    </main>
  );
}
