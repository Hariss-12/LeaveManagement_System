
import { defineConfig } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // index.html and the frontend assets are kept in public/.
  root: path.join(projectRoot, "public"),
  // The root itself contains the app files; it is not a Vite public-assets subfolder.
  publicDir: false,
  build: {
    outDir: path.join(projectRoot, "dist"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5050",
        changeOrigin: true,
      },
    },
  },
});
