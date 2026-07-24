import HandCutout from "@/components/HandCutout";

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Studio</h1>
      <p className="mt-1 text-neutral-400">
        Cut out any photo by hand — brush, magic wand and lasso, no auto-removal and no waiting. Open an image and select
        the subject yourself, then download the transparent PNG.
      </p>
      <div className="mt-6">
        <HandCutout />
      </div>
    </main>
  );
}
