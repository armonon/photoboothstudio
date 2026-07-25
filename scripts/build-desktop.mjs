// Build the static export that the Tauri desktop app bundles for offline use.
// Sets NEXT_DESKTOP so next.config emits `output: "export"`. Everything runs on-device.
import { spawnSync } from "node:child_process";

process.env.NEXT_DESKTOP = "1";

const staged = spawnSync("node", ["scripts/copy-ort.mjs"], { stdio: "inherit" });
if (staged.status) process.exit(staged.status);

const fetched = spawnSync("node", ["scripts/fetch-model.mjs"], { stdio: "inherit" });
if (fetched.status) process.exit(fetched.status);

const r = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(r.status ?? 1);
