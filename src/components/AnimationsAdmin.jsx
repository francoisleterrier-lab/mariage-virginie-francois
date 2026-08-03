import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* Onglet admin « Animations » : active / met en veille les grandes animations.
   Un réglage unique dans parametres (cle = 'animations', valeur = { key: bool }).
   Quand une animation est en veille, sa section se masque pour les invités. */

const FEATURES = [
  { key: "vitrail", label: "Le Vitrail Sonore", desc: "Les invités laissent leur voix ; elle devient un pétale du vitrail collectif." },
  { key: "coffre", label: "Le Coffre des invités", desc: "Jeu de rencontres : récolter les sceaux des autres pour ouvrir le coffre." },
  { key: "chasse", label: "La Chasse au domaine", desc: "Radar GPS vers des balises cachées qui révèlent des souvenirs (jour J)." },
  { key: "telegramme", label: "Le Télégramme", desc: "Les mots des invités s'impriment en vrai (nécessite l'imprimante branchée)." },
];

export default function AnimationsAdmin() {
  const [flags, setFlags] = useState({});
  const [chargé, setChargé] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase.from("parametres").select("valeur").eq("cle", "animations").maybeSingle();
    setFlags(data?.valeur || {});
    setChargé(true);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function basculer(key) {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    await supabase.from("parametres").upsert({ cle: "animations", valeur: next }, { onConflict: "cle" });
  }

  return (
    <div className="admin-bloc">
      <h2 className="admin-h2">Animations 🎬</h2>
      <p className="admin-sous">
        Activez une animation quand vous voulez qu'elle apparaisse pour les invités, ou mettez-la en veille pour la
        cacher (utile avant le jour J). Les changements sont immédiats.
      </p>

      <ul className="anim-liste">
        {FEATURES.map((f) => {
          const on = !!flags[f.key];
          return (
            <li key={f.key} className="anim-item">
              <div className="anim-txt">
                <strong>{f.label}</strong>
                <span className={"anim-etat" + (on ? " on" : "")}>{on ? "Active" : "En veille"}</span>
                <p>{f.desc}</p>
              </div>
              <button
                type="button"
                className={"anim-switch" + (on ? " on" : "")}
                role="switch"
                aria-checked={on}
                aria-label={(on ? "Mettre en veille" : "Activer") + " " + f.label}
                disabled={!chargé}
                onClick={() => basculer(f.key)}
              >
                <span className="anim-knob" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
