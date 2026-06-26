/** @type {import('next').NextConfig} */
const nextConfig = {
  // The desktop build (NEXT_DESKTOP=1) produces a fully static export that Tauri bundles
  // for offline use. The hosted web build stays on the normal Next server runtime.
  output: process.env.NEXT_DESKTOP === "1" ? "export" : undefined,
};
export default nextConfig;
