/** @type {import('next').NextConfig} */
const desktop = process.env.NEXT_DESKTOP === "1";

const nextConfig = {
  // The desktop build (NEXT_DESKTOP=1) produces a fully static export that Tauri bundles
  // for offline use. The hosted web build stays on the normal Next server runtime.
  output: desktop ? "export" : undefined,
  // Cross-origin isolation enables multi-threaded wasm (much faster ISNet inference).
  // Not valid with `output: export` — the desktop app sets these via tauri.conf instead.
  ...(desktop
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
                { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
