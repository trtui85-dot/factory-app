import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/api": "http://localhost:4000",
      "/pdf": {
        target: "http://localhost:80",
        rewrite: (p) => p.replace(/^\/pdf/, "/factory-app/receipts"),
      },
    },
  },
});
