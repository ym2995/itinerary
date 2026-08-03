import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* base: "./" keeps every asset path relative, so the build works
   from any folder — including a GitHub Pages project URL. */
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "docs", emptyOutDir: true },
});
