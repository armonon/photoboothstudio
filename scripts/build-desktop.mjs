// Build the static export that the Tauri desktop app bundles for offline use.
// Sets NEXT_DESKTOP so next.config emits `output: "export"`, and points AI mode at
// the hosted Netlify functions (the desktop app has no local server).
import { spawnSync } from "node:child_process";

process.env.NEXT_DESKTOP = "1";
process.env.NEXT_PUBLIC_FN_BASE =
  process.env.NEXT_PUBLIC_FN_BASE || "https://photoboothstudio-b6ac09.netlify.app";

const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
