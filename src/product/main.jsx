import React from "react";
import { createRoot } from "react-dom/client";
import "./product.css";
import Rendu from "./Rendu.jsx";
import Editeur from "./Editeur.jsx";

/* Un slug dans l'URL (?i=camille-alex) → rendu public de l'invitation.
   Sinon → espace de création (éditeur self-service). */
const slug = new URLSearchParams(location.search).get("i");

createRoot(document.getElementById("fpv-root")).render(
  <React.StrictMode>{slug ? <Rendu slug={slug} /> : <Editeur />}</React.StrictMode>
);
