import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  base: "/admin/",
  build: {
    outDir: resolve(__dirname, "../../services/backend/admin-dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/admin/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
