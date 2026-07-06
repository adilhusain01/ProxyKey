import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"

import { tanstackStart } from "@tanstack/react-start/plugin/vite"

import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  envDir: "../..",
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@proxykey/casper": fileURLToPath(
        new URL("../../packages/casper/src/index.ts", import.meta.url),
      ),
      "@proxykey/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
