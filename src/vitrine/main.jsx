import React from "react";
import { createRoot } from "react-dom/client";
import "./vitrine.css";
import Vitrine from "./Vitrine.jsx";

createRoot(document.getElementById("vitrine-root")).render(
  <React.StrictMode>
    <Vitrine />
  </React.StrictMode>
);
