import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "node:fs";
// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // Disable HTTPS when using emulator to avoid CORS issues
    // ...(process.env.VITE_USE_FUNCTIONS_EMULATOR === "true"
    //   ? {}
    //   : {
    //       https: {
    //         key: fs.readFileSync(new URL("./certs/localhost-key.pem", import.meta.url)),
    //         cert: fs.readFileSync(new URL("./certs/localhost.pem", import.meta.url)),
    //       },
    //     }),
    host: true,
    port: 5175,
    strictPort: true,
    allowedHosts: [
      "nitramino-undifficultly-ernestina.ngrok-free.dev"
    ]
  },

  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
