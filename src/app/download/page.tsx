import Link from "next/link";
import Reveal from "@/components/Reveal";
import { LogoMark } from "@/components/Logo";
import DownloadButtons from "@/components/DownloadButtons";

export const metadata = {
  title: "Download Model Studio — free desktop app",
  description: "Native Model Studio for macOS. Free background removal, layered studio and hand cutout — fully offline.",
};

const perks = [
  ["Works fully offline", "The AI model is bundled — no internet, no account, no credits."],
  ["Nothing leaves your Mac", "Every image is processed on-device. Zero uploads."],
  ["The whole toolkit", "Background removal, the layered Studio with text, and by-hand cutout."],
];

export default function DownloadPage() {
  return (
    <main className="relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(55% 45% at 50% 0%, rgba(56,189,248,.14), transparent 70%)" }}
      />
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <Reveal>
          <LogoMark className="mx-auto h-14 w-14" />
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">Model Studio for desktop</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-400">
            The full app, native and free. Install it once and everything runs on your machine — even on a plane.
          </p>
          <div className="mt-8 flex justify-center">
            <DownloadButtons />
          </div>
          <p className="mt-3 text-xs text-neutral-600">
            macOS (Apple Silicon). Prefer the browser?{" "}
            <Link href="/remove" className="text-sky-300 hover:underline">
              Open the web app →
            </Link>
          </p>
        </Reveal>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {perks.map(([t, d], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="h-full rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
                <div className="text-sm font-semibold text-neutral-100">{t}</div>
                <div className="mt-1.5 text-sm text-neutral-400">{d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </main>
  );
}
