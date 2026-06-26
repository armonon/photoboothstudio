"use client";

import { useEffect, useState } from "react";

const REPO = "armonon/photoboothstudio";
const RELEASES = `https://github.com/${REPO}/releases`;

interface Downloads {
  version?: string;
  mac?: string;
  macIntel?: string;
  win?: string;
}

export default function DownloadButtons() {
  const [data, setData] = useState<Downloads | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rel: { tag_name?: string; assets?: { name: string; browser_download_url: string }[] }) => {
        const find = (re: RegExp) => rel.assets?.find((a) => re.test(a.name))?.browser_download_url;
        setData({
          version: rel.tag_name,
          mac: find(/aarch64\.dmg$/),
          macIntel: find(/x64\.dmg$/),
          win: find(/x64-setup\.exe$/) || find(/\.msi$/),
        });
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="text-sm text-neutral-400">
        Couldn&rsquo;t load the latest release.{" "}
        <a href={RELEASES} className="underline underline-offset-4 hover:text-neutral-200">
          Open the releases page →
        </a>
      </p>
    );
  }
  if (!data) return <p className="text-sm text-neutral-500">Loading latest release…</p>;

  const Btn = ({ href, title, sub }: { href?: string; title: string; sub: string }) =>
    href ? (
      <a
        href={href}
        className="flex flex-col rounded-lg border border-neutral-700 bg-neutral-900 px-5 py-4 transition hover:border-neutral-500"
      >
        <span className="font-medium text-neutral-100">{title}</span>
        <span className="mt-0.5 text-xs text-neutral-500">{sub}</span>
      </a>
    ) : null;

  return (
    <div className="space-y-4">
      {data.version && <p className="text-xs text-neutral-500">Latest release: {data.version}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Btn href={data.mac} title="macOS · Apple Silicon" sub="M1 / M2 / M3 — .dmg" />
        <Btn href={data.macIntel} title="macOS · Intel" sub=".dmg" />
        <Btn href={data.win} title="Windows" sub="Installer — .exe" />
      </div>
      <p className="text-xs text-neutral-600">
        Free background removal runs fully offline. Unsigned build — on first open: macOS right-click → Open;
        Windows &ldquo;More info → Run anyway&rdquo;.
      </p>
    </div>
  );
}
