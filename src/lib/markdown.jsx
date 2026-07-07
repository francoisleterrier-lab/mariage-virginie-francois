import React from "react";

/* ============================================================
   Rendu « markdown léger » SÛR : **gras**, *italique*, retours ligne.
   Construit des nœuds React (échappés automatiquement) — jamais de
   dangerouslySetInnerHTML : aucune injection HTML/JS possible.
   ============================================================ */
function inline(line) {
  const nodes = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/;
  let rest = line;
  let k = 0;
  let m;
  while ((m = re.exec(rest))) {
    const avant = rest.slice(0, m.index);
    if (avant) nodes.push(avant);
    if (m[2] != null) nodes.push(<strong key={k++}>{m[2]}</strong>);
    else nodes.push(<em key={k++}>{m[3]}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  if (rest) nodes.push(rest);
  return nodes;
}

export function renderRichText(texte) {
  if (!texte) return null;
  const lignes = String(texte).split(/\r?\n/);
  return lignes.map((l, i) => (
    <React.Fragment key={i}>
      {inline(l)}
      {i < lignes.length - 1 ? <br /> : null}
    </React.Fragment>
  ));
}
