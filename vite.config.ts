import { defineConfig } from "vite";
<<<<<<< HEAD
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
=======
import react from "@vitejs/plugin-react-swc";
import path from "path";
>>>>>>> repoB/master

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
<<<<<<< HEAD
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
=======
  plugins: [react()],
>>>>>>> repoB/master
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
