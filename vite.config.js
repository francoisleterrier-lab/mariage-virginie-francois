import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// base : '/mariage-virginie-francois/' sur GitHub Pages (via BASE_PATH dans le
// workflow), sinon './' → dist/ uploadable tel quel sur n'importe quel serveur.
const base = process.env.BASE_PATH || "./";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // SW écrit à la main (src/sw.js) pour gérer le push ; Workbox y
      // injecte le manifeste de précache du shell.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      injectManifest: {
        // Shell précaché ; les médias lourds passent par le SWR runtime.
        globPatterns: ["**/*.{js,css,html,woff2}"],
        globIgnores: ["**/icon-*.png"],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      manifest: {
        name: "Virginie & François — 26 & 27 mai 2028",
        short_name: "V & F 2028",
        description: "Faire-part privé du mariage de Virginie & François.",
        lang: "fr",
        display: "standalone",
        orientation: "portrait",
        background_color: "#22382C",
        theme_color: "#22382C",
        // start_url / scope sont dérivés automatiquement de `base` par le plugin.
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        // Site de mariage V&F (inchangé)
        main: new URL("./index.html", import.meta.url).pathname,
        // Produit « Faire-part Vivant » : éditeur + rendu multi-clients
        product: new URL("./product.html", import.meta.url).pathname,
      },
    },
  },
});
