import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split large libraries into their own cached files.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          docx: ["docx"],
          katex: ["katex"],
          icons: ["lucide-react"],
        },
      },
    },
  },
});
