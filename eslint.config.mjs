import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  {
    ignores: [
      ".next/**",
      ".netlify/**",
      "out/**",
      "build/**",
      "node_modules/**",
      "public/**",
      "src-tauri/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Parked AI adapters and Netlify functions are thin wrappers over an untyped
    // external API; `any` at that boundary and anonymous default exports are fine here.
    files: ["src/lib/ai/**", "netlify/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default config;
