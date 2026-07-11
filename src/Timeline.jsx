/* Timeline « qui se dévoile » : les moments révélés montrent leur contenu ;
   les moments à venir montrent leur titre + la date de révélation (le contenu
   reste masqué côté serveur). Sans dépendance ni CSS externe → partagé produit
   + V&F ; s'adapte à l'univers via la prop `accent` et hérite de la couleur
   du texte environnant. `moments` : [{id, titre, contenu, reveal_at, revele}]. */

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
};

export default function Timeline({ moments = [], accent = "#c9a24b" }) {
  if (!moments.length) return null;
  const dernier = moments.length - 1;
  return (
    <ol style={{ listStyle: "none", margin: "1.8rem auto 0", padding: 0, maxWidth: 620, textAlign: "left" }}>
      {moments.map((m, i) => (
        <li
          key={m.id}
          style={{
            position: "relative",
            padding: i === dernier ? "0 0 0 2rem" : "0 0 1.7rem 2rem",
            borderLeft: `2px solid ${i === dernier ? "transparent" : "rgba(127,127,127,.28)"}`,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute", left: -8, top: 3, width: 14, height: 14, borderRadius: "50%",
              background: m.revele ? accent : "transparent", border: `2px solid ${accent}`,
            }}
          />
          <div style={{ fontSize: ".78rem", letterSpacing: ".05em", opacity: 0.72, textTransform: "uppercase" }}>
            {m.revele ? fmt(m.reveal_at) : `Se dévoile le ${fmt(m.reveal_at)}`}
          </div>
          <h3 style={{ margin: ".2rem 0 .35rem", fontSize: "1.25rem", fontWeight: 600, opacity: m.revele ? 1 : 0.75 }}>
            {m.revele ? "" : "🔒 "}
            {m.titre}
          </h3>
          {m.revele ? (
            (m.contenu || "").trim()
              ? m.contenu.split(/\n{2,}/).map((p, k) => <p key={k} style={{ margin: ".3rem 0", lineHeight: 1.55 }}>{p}</p>)
              : null
          ) : (
            <p style={{ margin: ".3rem 0", fontStyle: "italic", opacity: 0.62 }}>Encore un peu de patience…</p>
          )}
        </li>
      ))}
    </ol>
  );
}
