import { useState } from "react";

/* « Ajouter à mon agenda » : Google Agenda + fichier .ics (Apple, Outlook…).
   Sans dépendance (ni supabase, ni CSS externe) → partagé produit + V&F.
   Événement « journée entière » (DTEND exclusif). `dateISO` = "YYYY-MM-DD",
   `jours` = durée en jours. `labels` permet de traduire. */

const LABELS = { ajouter: "📅 Ajouter à mon agenda", google: "Google Agenda", ics: "Apple · Outlook (.ics)" };

function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}
const esc = (s) => (s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

export default function AgendaBouton({ titre, dateISO, jours = 1, lieu = "", details = "", accent = "#c9a24b", labels }) {
  const [ouvert, setOuvert] = useState(false);
  const L = { ...LABELS, ...(labels || {}) };
  if (!dateISO) return null;

  const start = new Date(dateISO + "T12:00:00");
  if (isNaN(start)) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(1, jours));
  const s = ymd(start);
  const e = ymd(end);

  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titre || "")}` +
    `&dates=${s}/${e}` +
    (details ? `&details=${encodeURIComponent(details)}` : "") +
    (lieu ? `&location=${encodeURIComponent(lieu)}` : "");

  function texteIcs() {
    let stamp;
    try {
      stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    } catch {
      stamp = s + "T000000Z";
    }
    const uid = `${s}-${(titre || "event").toLowerCase().replace(/[^a-z0-9]/g, "")}@faire-part-vivant`;
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Faire-part Vivant//FR",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${s}`,
      `DTEND;VALUE=DATE:${e}`,
      `SUMMARY:${esc(titre)}`,
      lieu ? `LOCATION:${esc(lieu)}` : "",
      details ? `DESCRIPTION:${esc(details)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
  }

  function telechargerIcs() {
    try {
      const blob = new Blob([texteIcs()], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mariage.ics";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch {
      /* ignore */
    }
  }

  const btn = {
    display: "inline-flex", alignItems: "center", gap: ".4rem", cursor: "pointer",
    border: `1px solid ${accent}`, background: "transparent", color: "inherit",
    borderRadius: 999, padding: ".55rem 1.2rem", font: "inherit", fontWeight: 600, textDecoration: "none",
  };

  return (
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: ".5rem", justifyContent: "center" }}>
      {!ouvert ? (
        <button type="button" style={btn} onClick={() => setOuvert(true)}>{L.ajouter}</button>
      ) : (
        <>
          <a style={btn} href={googleUrl} target="_blank" rel="noopener noreferrer">{L.google}</a>
          <button type="button" style={btn} onClick={telechargerIcs}>{L.ics}</button>
        </>
      )}
    </div>
  );
}
