import Link from "next/link";
import Reveal from "@/components/Reveal";
import { LogoMark } from "@/components/Logo";
import { StudioShot, RemoveShot, CutoutShot } from "@/components/Mockups";
import DownloadButtons from "@/components/DownloadButtons";
import DesktopRedirect from "@/components/DesktopRedirect";

export const metadata = {
  title: "Model Studio — studio-grade product shots, free & offline",
  description:
    "Remove backgrounds, cut out by hand, and compose layered product mockups with text — all locally in your browser or on your desktop. Free, no credits, nothing uploaded.",
};

function Feature({
  eyebrow,
  title,
  body,
  points,
  shot,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  shot: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <Reveal className={flip ? "md:order-2" : ""}>
        <div className="text-xs font-semibold uppercase tracking-widest text-sky-400">{eyebrow}</div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3>
        <p className="mt-3 text-neutral-400">{body}</p>
        <ul className="mt-4 space-y-2 text-sm text-neutral-300">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="mt-0.5 text-sky-400">✓</span>
              {p}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={80} className={flip ? "md:order-1" : ""}>
        {shot}
      </Reveal>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="overflow-hidden">
      <DesktopRedirect />
      {/* hero */}
      <section className="relative">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgba(56,189,248,.16), transparent 70%), radial-gradient(50% 50% at 85% 20%, rgba(99,102,241,.14), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pb-10 pt-16 sm:pt-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Free · offline · nothing uploaded
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
              Studio-grade product shots,
              <br />
              <span className="bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">without the studio.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-400">
              Remove backgrounds, cut out by hand, and compose layered mockups with text — right in your browser or on
              your desktop. No credits, no uploads, no subscription.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/remove" className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200">
                Open the app — free
              </Link>
              <Link href="/download" className="rounded-lg border border-neutral-700 px-5 py-2.5 text-sm font-medium text-neutral-100 hover:border-neutral-500">
                Download for Mac
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120} className="mx-auto mt-14 max-w-4xl">
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-sky-500/10 to-indigo-500/10 blur-2xl" />
              <StudioShot />
            </div>
          </Reveal>
        </div>
      </section>

      {/* features */}
      <section className="mx-auto max-w-6xl space-y-24 px-6 py-24">
        <Feature
          eyebrow="One click"
          title="Background removal that just works"
          body="A local AI model lifts the garment off any backdrop in seconds — fully offline, so nothing ever leaves your machine. Batch a whole shoot and download them all as a ZIP."
          points={["Runs on-device, no account or credits", "White, soft-grey, or transparent output", "Optional auto color, contact shadow & framing"]}
          shot={<RemoveShot />}
        />
        <Feature
          flip
          eyebrow="Layered Studio"
          title="Compose like a designer"
          body="Drop in multiple images — each becomes a layer. Arrange, resize, restack, and set opacity. Add text with any font you like, then export the flattened PNG."
          points={["Multi-image layers with opacity & reorder", "Text layers — upload fonts or use your installed ones", "Non-destructive resize per layer"]}
          shot={<StudioShot />}
        />
        <Feature
          eyebrow="Precision"
          title="Cut it out by hand"
          body="When the auto-cut misses, take over. Magic-wand a background, lasso the subject, or brush the edges — with grow, shrink and feather to finish it clean."
          points={["Magic wand, lasso & soft brush", "Keep / Remove with instant undo", "Grow · Shrink · Smooth edge tools"]}
          shot={<CutoutShot />}
        />
      </section>

      {/* stats band */}
      <section className="border-y border-neutral-800 bg-neutral-900/30">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 text-center sm:grid-cols-4">
          {[
            ["$0", "forever — no credits"],
            ["100%", "on-device & offline"],
            ["0", "images uploaded"],
            ["Mac + Web", "same app, anywhere"],
          ].map(([n, l]) => (
            <Reveal key={l}>
              <div className="text-3xl font-semibold tracking-tight text-neutral-100">{n}</div>
              <div className="mt-1 text-xs text-neutral-500">{l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center">
        <Reveal>
          <LogoMark className="mx-auto h-12 w-12" />
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Make your next mockup in a minute.</h2>
          <p className="mx-auto mt-3 max-w-lg text-neutral-400">
            Open it in the browser, or install the free desktop app and work fully offline.
          </p>
          <div className="mt-8 flex justify-center">
            <DownloadButtons />
          </div>
          <div className="mt-4">
            <Link href="/remove" className="text-sm text-sky-300 hover:underline">
              or just open it in your browser →
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
