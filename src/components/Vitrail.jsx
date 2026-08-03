import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

/* « Le Vitrail Sonore » — la voix des invités devient une œuvre vivante.
   L'invité enregistre ~10 s ; on dérive un « pétale » de l'empreinte
   fréquentielle de sa voix ; tous les pétales composent le vitrail ;
   toucher un pétale rejoue la vraie voix. Audio dans vf-photos/voix/. */

const urlOf = (chemin) => supabase.storage.from("vf-photos").getPublicUrl(chemin).data.publicUrl;
const DUREE = 10; // secondes max

function Petale({ p, taille = 104 }) {
  const hue = Number.isFinite(p?.hue) ? p.hue : 40;
  const petals = Math.max(4, Math.min(9, p?.petals || 6));
  const sat = Math.max(35, Math.min(85, p?.sat || 60));
  const seed = p?.seed || 0;
  const c = taille / 2;
  return (
    <svg viewBox={`0 0 ${taille} ${taille}`} width={taille} height={taille} aria-hidden="true">
      <g transform={`rotate(${seed} ${c} ${c})`}>
        {Array.from({ length: petals }).map((_, i) => {
          const a = (360 / petals) * i;
          const h = (hue + i * 9) % 360;
          return (
            <ellipse key={i} cx={c} cy={c * 0.52} rx={c * 0.22} ry={c * 0.42}
              fill={`hsl(${h} ${sat}% 56%)`} opacity="0.85"
              transform={`rotate(${a} ${c} ${c})`} />
          );
        })}
      </g>
      <circle cx={c} cy={c} r={c * 0.16} fill="hsl(45 72% 62%)" />
    </svg>
  );
}

export default function Vitrail({ profile }) {
  const [voix, setVoix] = useState([]);
  const [etat, setEtat] = useState("idle"); // idle | enregistrement | envoi
  const [chrono, setChrono] = useState(0);
  const [err, setErr] = useState("");
  const [dispo, setDispo] = useState(true);
  const rec = useRef(null);
  const stopTimer = useRef(null);
  const audioRef = useRef(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from("voix")
      .select("id, invite_id, prenom, chemin, params, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      setDispo(false);
      return;
    }
    setDispo(true);
    setVoix(data || []);
  }, []);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 8000); // le vitrail grandit en direct
    return () => clearInterval(t);
  }, [charger]);

  async function sauver(blob, params) {
    setEtat("envoi");
    try {
      const path = `voix/${profile.id}-${Date.now()}.webm`;
      const { error: up } = await supabase.storage.from("vf-photos").upload(path, blob, {
        contentType: blob.type || "audio/webm",
      });
      if (up) throw up;
      const prenom = (profile.nom || "").split(" ")[0];
      const { error } = await supabase.from("voix").insert({ invite_id: profile.id, prenom, chemin: path, params });
      if (error) throw error;
      await charger();
    } catch (e) {
      setErr(e.message || "Envoi impossible.");
    }
    setEtat("idle");
  }

  async function enregistrer() {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErr("Votre appareil ne permet pas l'enregistrement audio.");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErr("Micro non autorisé. Activez l'accès au micro pour laisser votre voix.");
      return;
    }
    setEtat("enregistrement");
    setChrono(DUREE);

    // Analyse fréquentielle pour dériver le pétale.
    let ac, analyser, sampler;
    let sumCentroid = 0, sumEnergy = 0, frames = 0;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      const srcNode = ac.createMediaStreamSource(stream);
      analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      srcNode.connect(analyser);
      const freq = new Uint8Array(analyser.frequencyBinCount);
      sampler = setInterval(() => {
        analyser.getByteFrequencyData(freq);
        let num = 0, den = 0, e = 0;
        for (let i = 0; i < freq.length; i++) { num += i * freq[i]; den += freq[i]; e += freq[i]; }
        if (den > 0) { sumCentroid += num / den / freq.length; sumEnergy += e / freq.length; frames++; }
      }, 100);
    } catch {
      /* analyse indisponible → pétale par défaut */
    }

    const chunks = [];
    const mr = new MediaRecorder(stream);
    rec.current = mr;
    mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    mr.onstop = async () => {
      if (sampler) clearInterval(sampler);
      stream.getTracks().forEach((t) => t.stop());
      if (ac) ac.close().catch(() => {});
      const centroid = frames ? Math.min(1, sumCentroid / frames) : 0.4;
      const energy = frames ? Math.min(1, sumEnergy / frames / 110) : 0.5;
      const params = {
        hue: Math.round(15 + centroid * 300),
        petals: 5 + Math.round(energy * 4),
        sat: Math.round(45 + energy * 35),
        seed: Math.round(centroid * 359),
      };
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      await sauver(blob, params);
    };

    mr.start();
    stopTimer.current = setInterval(() => {
      setChrono((c) => {
        if (c <= 1) { arreter(); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function arreter() {
    if (stopTimer.current) { clearInterval(stopTimer.current); stopTimer.current = null; }
    if (rec.current && rec.current.state === "recording") rec.current.stop();
  }

  function jouer(v) {
    try {
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio(urlOf(v.chemin));
      audioRef.current = a;
      a.play().catch(() => setErr("Lecture impossible sur cet appareil."));
    } catch {
      /* ignore */
    }
  }

  async function supprimer(v) {
    if (!window.confirm("Retirer ce pétale ?")) return;
    await supabase.from("voix").delete().eq("id", v.id);
    supabase.storage.from("vf-photos").remove([v.chemin]).catch(() => {});
    charger();
  }

  if (!dispo) return null; // tables pas encore créées → section masquée

  const estAdmin = profile?.role === "admin";

  return (
    <section className="vitrail" id="vitrail">
      <div className="wrap center reveal">
        <p className="eyebrow">Le vitrail sonore</p>
        <h2>Laissez votre <em>voix</em> dans notre vitrail</h2>
        <p>
          Enregistrez un petit mot, un vœu, un souvenir. Votre voix devient un pétale de couleur unique — et compose,
          avec toutes les autres, une œuvre vivante. Touchez un pétale pour réentendre celui ou celle qui l'a laissé.
        </p>

        {etat === "idle" && (
          <button type="button" className="btn-vert vitrail-btn" onClick={enregistrer}>🎙️ Laisser ma voix</button>
        )}
        {etat === "enregistrement" && (
          <button type="button" className="btn-vert vitrail-btn vitrail-rec" onClick={arreter}>
            ● Enregistrement… {chrono}s — appuyez pour arrêter
          </button>
        )}
        {etat === "envoi" && <p className="album-vide">Création de votre pétale…</p>}
        {err && <p className="gate-err" style={{ color: "#b06a4f" }}>{err}</p>}

        {voix.length === 0 ? (
          <p className="album-vide" style={{ marginTop: "1.5rem" }}>Le vitrail attend son premier pétale 🌿</p>
        ) : (
          <div className="vitrail-grille">
            {voix.map((v) => (
              <figure key={v.id} className="vitrail-petale">
                <button type="button" onClick={() => jouer(v)} aria-label={`Écouter ${v.prenom || "un invité"}`}>
                  <Petale p={v.params} />
                </button>
                <figcaption>{v.prenom || "Un invité"}</figcaption>
                {(estAdmin || v.invite_id === profile?.id) && (
                  <button type="button" className="vitrail-x" onClick={() => supprimer(v)} aria-label="Retirer">×</button>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
