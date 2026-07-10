import Enhancer from "@/components/Enhancer";

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Studio</h1>
      <p className="mt-1 text-neutral-400">
        Cut out and polish in one step — auto color &amp; lighting, a contact shadow, and clean framing. Hit{" "}
        <span className="text-sky-300">Edit</span> on any result to refine the selection by hand.
      </p>
      <div className="mt-6">
        <Enhancer mode="studio" />
      </div>
    </main>
  );
}
