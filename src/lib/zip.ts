import { zip } from "fflate";

/**
 * Bundle finished mockups into a single ZIP, entirely in the browser — no server,
 * so it works the same locally and on a serverless host. PNGs are already compressed,
 * so entries are stored (level 0) rather than re-deflated.
 */
export async function zipImages(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const file of files) {
    entries[file.name] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }];
  }
  return new Promise((resolve, reject) => {
    zip(entries, (err, data) => (err ? reject(err) : resolve(new Blob([data], { type: "application/zip" }))));
  });
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
