import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Standalone replacement for @lovable.dev/vite-tanstack-config, now that the app is
// deploying to Vercel instead of Lovable's own Cloudflare-based hosting. Reconstructed by
// reading that wrapper's own source (it's/was already a direct dependency) rather than
// guessing at Vite/TanStack Start/Nitro's plugin APIs from scratch -- it's the same core
// plugin set (Tailwind, tsconfig paths, TanStack Start, Nitro, React, VITE_* env
// injection, the "@" path alias, and the same React/TanStack dedupe list), minus
// everything that only ever did something inside Lovable's own sandbox/editor (dev-time
// error loggers that pushed to Lovable's editor overlay via a websocket, build
// diagnostics reporters, the HMR gate, the assets proxy, the prerender-preview shim,
// etc.) -- none of that runs unless a Lovable-specific env var is set, so dropping it
// changes nothing about how the app actually behaves once deployed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
    server: { host: "::", port: 8080 },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      nitro({ preset: "vercel" }),
      viteReact(),
    ],
  };
});
