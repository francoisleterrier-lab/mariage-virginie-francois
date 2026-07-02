import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: './' => chemins relatifs dans dist/, uploadable tel quel sur
// n'importe quel serveur statique (racine ou sous-dossier).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // les assets (vidéo, photos) sont copiés/hashés par Vite ; on garde
    // la vidéo en fichier séparé (pas d'inline) pour le streaming mobile.
    assetsInlineLimit: 4096,
  },
});
