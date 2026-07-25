import { ReactNode } from "react";

const CHECKER =
  "linear-gradient(45deg,#2a2a2a 25%,transparent 25%),linear-gradient(-45deg,#2a2a2a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a2a 75%),linear-gradient(-45deg,transparent 75%,#2a2a2a 75%)";

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 py-2">
        <span className="h-3 w-3 rounded-full bg-red-400/80" />
        <span className="h-3 w-3 rounded-full bg-amber-400/80" />
        <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-[11px] text-neutral-500">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({ active, children }: { active?: boolean; children: ReactNode }) {
  return (
    <span className={`rounded px-2 py-1 text-[10px] font-medium ${active ? "bg-white text-black" : "bg-neutral-800 text-neutral-300"}`}>
      {children}
    </span>
  );
}

function Tee({ className = "", fill = "#2b6e78" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 120 130" className={className} aria-hidden="true">
      <path
        d="M42 12 L54 6 Q60 14 66 6 L78 12 L96 26 L86 44 L78 39 L78 120 L42 120 L42 39 L34 44 L24 26 Z"
        fill={fill}
      />
    </svg>
  );
}

/** The layered Studio editor — the hero shot. */
export function StudioShot() {
  return (
    <Frame title="Model Studio — Studio">
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-3 py-2">
        <Pill active>Move</Pill>
        <Pill>Brush</Pill>
        <Pill>Magic Wand</Pill>
        <Pill>Lasso</Pill>
        <Pill>+ Text</Pill>
        <span className="ml-auto flex gap-1.5">
          <Pill>Add images</Pill>
          <span className="rounded bg-white px-2 py-1 text-[10px] font-semibold text-black">Export PNG</span>
        </span>
      </div>
      <div className="flex">
        <div className="relative min-h-[240px] flex-1" style={{ backgroundImage: CHECKER, backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0" }}>
          <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-rose-500 to-orange-400 opacity-90" />
          <Tee className="absolute left-1/2 top-1/2 h-40 -translate-x-1/2 -translate-y-[46%]" />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-2xl font-black tracking-tight text-white" style={{ fontFamily: "Impact, sans-serif" }}>
            NEW DROP
          </div>
        </div>
        <div className="w-40 shrink-0 border-l border-neutral-800 text-[10px]">
          <div className="border-b border-neutral-800 px-3 py-2 font-semibold uppercase tracking-wide text-neutral-500">Layers</div>
          {[
            { n: "NEW DROP", c: "from-neutral-200 to-neutral-400" },
            { n: "shirt.png", c: "from-teal-400 to-teal-600" },
            { n: "backdrop", c: "from-rose-400 to-orange-400" },
          ].map((l, i) => (
            <div key={l.n} className={`flex items-center gap-2 border-b border-neutral-900 px-2 py-2 ${i === 1 ? "bg-sky-500/10" : ""}`}>
              <span className="text-neutral-400">👁</span>
              <span className={`h-7 w-7 rounded bg-gradient-to-br ${l.c}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-neutral-300">{l.n}</span>
                <span className="mt-1 block h-1 w-full rounded bg-neutral-700">
                  <span className="block h-1 rounded bg-sky-400" style={{ width: `${90 - i * 20}%` }} />
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Background removal — before/after. */
export function RemoveShot() {
  return (
    <Frame title="Model Studio — Remove Background">
      <div className="grid grid-cols-2">
        <div className="relative min-h-[190px] bg-gradient-to-br from-amber-200/20 to-neutral-800">
          <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-neutral-300">Before</span>
          <div className="absolute inset-0 grid place-items-center">
            <Tee className="h-32" fill="#b23b3b" />
          </div>
        </div>
        <div className="relative min-h-[190px] border-l border-neutral-800" style={{ backgroundImage: CHECKER, backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0" }}>
          <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-emerald-300">After</span>
          <div className="absolute inset-0 grid place-items-center">
            <Tee className="h-32" fill="#b23b3b" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/** Hand-cutout tools. */
export function CutoutShot() {
  return (
    <Frame title="Model Studio — Edit">
      <div className="flex items-center gap-1.5 border-b border-neutral-800 px-3 py-2">
        <Pill>Brush</Pill>
        <Pill active>Magic Wand</Pill>
        <Pill>Lasso</Pill>
        <span className="ml-2 flex overflow-hidden rounded border border-neutral-700 text-[10px]">
          <span className="px-1.5 py-1 text-neutral-400">Keep</span>
          <span className="bg-red-500/25 px-1.5 py-1 text-red-200">Remove</span>
        </span>
        <span className="ml-auto flex gap-1.5">
          <Pill>Grow</Pill>
          <Pill>Shrink</Pill>
          <Pill>Smooth</Pill>
        </span>
      </div>
      <div className="relative min-h-[200px]" style={{ backgroundImage: CHECKER, backgroundSize: "16px 16px", backgroundPosition: "0 0,0 8px,8px -8px,-8px 0" }}>
        <div className="absolute inset-0 grid place-items-center">
          <Tee className="h-40" fill="#2b6e78" />
        </div>
        <span className="absolute right-6 top-8 h-16 w-16 rounded-full border-2 border-dashed border-white/70" />
      </div>
    </Frame>
  );
}
