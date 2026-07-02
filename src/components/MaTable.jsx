import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

/* ============================================================
   « Ma table » côté invité.
   - Invisible (carte mystère) tant que le paramètre plan_visible
     n'est pas activé par l'admin.
   - Une fois activé : nom de sa table, voisins, mini-plan de salle
     avec sa table mise en évidence (or).
   ============================================================ */
export default function MaTable({ profile }) {
  const [visible, setVisible] = useState(null); // null = chargement
  const [tables, setTables] = useState([]);
  const [voisins, setVoisins] = useState([]);

  useEffect(() => {
    (async () => {
      const { data: param } = await supabase
        .from("parametres")
        .select("valeur")
        .eq("cle", "plan_visible")
        .maybeSingle();
      const actif = param?.valeur === true;
      setVisible(actif);
      if (!actif) return;

      const [{ data: t }, { data: v }] = await Promise.all([
        supabase.from("tables_plan").select("id, nom, forme, pos_x, pos_y"),
        supabase.rpc("mes_voisins"),
      ]);
      setTables(t || []);
      setVoisins((v || []).map((r) => r.nom));
    })();
  }, [profile.table_id]);

  if (visible === null) return null;

  const maTable = tables.find((t) => t.id === profile.table_id);

  return (
    <section className="matable" id="matable">
      {/* pas de classe `reveal` : cette section est rendue après un chargement
          async, or l'observateur de scroll est posé au montage → elle resterait
          invisible (opacity:0). On l'affiche donc directement. */}
      <div className="wrap center">
        <p className="eyebrow">Votre place</p>

        {!visible || !profile.table_id ? (
          <>
            <h2>
              Votre place se <em>prépare</em>…
            </h2>
            <div className="matable-mystere">
              <div className="q">🌿</div>
              <p>
                Le plan de salle est en cours de dessin. Votre table et vos voisins de tablée vous seront
                révélés ici quelques jours avant le grand jour.
              </p>
            </div>
          </>
        ) : (
          <>
            <h2>
              Vous êtes à la <em>{maTable?.nom || "table à venir"}</em>
            </h2>

            {voisins.length > 0 && (
              <p className="matable-voisins">
                À vos côtés : <strong>{voisins.join(", ")}</strong>
              </p>
            )}

            <div className="miniplan" role="img" aria-label={`Plan de salle, votre place : ${maTable?.nom}`}>
              {tables.map((t) => {
                const moi = t.id === profile.table_id;
                return (
                  <div
                    key={t.id}
                    className={"miniplan-t" + (moi ? " moi" : "") + (t.forme === "rectangle" ? " rect" : "")}
                    style={{ left: `${t.pos_x}%`, top: `${t.pos_y}%` }}
                    title={t.nom}
                  >
                    <span>{moi ? "★" : ""}</span>
                  </div>
                );
              })}
            </div>
            <p className="miniplan-legende">★ votre table</p>
          </>
        )}
      </div>
    </section>
  );
}
