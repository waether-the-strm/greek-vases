import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    host: true,
  },
  build: {
    sourcemap: true,
    minify: "terser",
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    include: ["three"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
