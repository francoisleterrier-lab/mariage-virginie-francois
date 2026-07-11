import React from "react";
import { createRoot } from "react-dom/client";
import "./product.css";
import Rendu from "./Rendu.jsx";
import Editeur from "./Editeur.jsx";
import DiaporamaLive from "./DiaporamaLive.jsx";

/* ?i=camille-alex        → rendu public de l'invitation.
   ?i=camille-alex&live=1 → diaporama plein écran (grand écran de la soirée).
   sinon                  → espace de création (éditeur self-service). */
const params = new URLSearchParams(location.search);
const slug = params.get("i");
const live = params.get("live") === "1";

createRoot(document.getElementById("fpv-root")).render(
  <React.StrictMode>
    {slug ? (live ? <DiaporamaLive slug={slug} /> : <Rendu slug={slug} />) : <Editeur />}
  </React.StrictMode>
);
