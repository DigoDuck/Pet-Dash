import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // A suíte não pode depender do .env local: o Vitest carrega .env, e um
    // VITE_API_URL apontando para outra porta faz os handlers do MSW não casarem
    // (com onUnhandledRequest: "error", a suíte inteira cai).
    env: { VITE_API_URL: "http://localhost:8000/api" },
  },
});
