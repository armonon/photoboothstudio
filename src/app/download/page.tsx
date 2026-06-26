import DownloadButtons from "@/components/DownloadButtons";

export default function DownloadPage() {
  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-2xl font-semibold">Download the desktop app</h1>
      <p className="mt-1 text-neutral-400">
        Native Model Studio for macOS and Windows — free background removal works fully offline.
      </p>
      <div className="mt-6">
        <DownloadButtons />
      </div>
    </main>
  );
}
