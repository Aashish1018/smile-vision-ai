import { defineConfig } from "vitest/config";
<<<<<<< HEAD
import react from "@vitejs/plugin-react";
=======
import react from "@vitejs/plugin-react-swc";
>>>>>>> repoB/master
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
