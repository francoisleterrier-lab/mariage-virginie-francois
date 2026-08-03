// « Le Télégramme » — agent d'impression.
// À lancer sur un Raspberry Pi (ou un laptop) branché à une imprimante
// thermique ESC/POS. Il récupère les télégrammes en attente et les imprime,
// puis les marque 'printed'. Aucun secret ne quitte cette machine.
//
// Config par variables d'environnement (voir README.md) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   PRINTER_TYPE   = epson | star           (défaut epson)
//   PRINTER_IFACE  = printer:auto | tcp://192.168.1.50 | /dev/usb/lp0
//   SITE_URL       = https://.../ (pour le QR renvoyant vers l'album)
//   POLL_MS        = 4000

import { createClient } from "@supabase/supabase-js";
import pkg from "node-thermal-printer";
const { printer: ThermalPrinter, types: PrinterTypes } = pkg;

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_MS = Number(process.env.POLL_MS || 4000);
const SITE_URL = process.env.SITE_URL || "";
if (!URL || !KEY) {
  console.error("Manque SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

function makePrinter() {
  return new ThermalPrinter({
    type: (process.env.PRINTER_TYPE || "epson") === "star" ? PrinterTypes.STAR : PrinterTypes.EPSON,
    interface: process.env.PRINTER_IFACE || "printer:auto",
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

async function imprimer(t) {
  const p = makePrinter();
  const ok = await p.isPrinterConnected().catch(() => false);
  if (!ok) throw new Error("Imprimante non connectée");
  p.alignCenter();
  p.bold(true); p.setTextSize(1, 1);
  p.println("TELEGRAMME"); p.bold(false); p.setTextNormal();
  p.drawLine();
  p.alignLeft(); p.println("");
  p.println(t.texte);
  p.println("");
  p.alignRight(); p.bold(true); p.println("— " + (t.prenom || "Un invite")); p.bold(false);
  const d = new Date(t.created_at);
  p.alignCenter(); p.println(d.toLocaleString("fr-FR"));
  if (SITE_URL) { p.println(""); p.printQR(SITE_URL, { cellSize: 5 }); p.println("Vos photos & souvenirs"); }
  p.println(""); p.cut();
  await p.execute();
}

async function tour() {
  const { data, error } = await sb
    .from("telegrammes").select("*").eq("statut", "pending").order("created_at").limit(10);
  if (error) { console.error("Lecture:", error.message); return; }
  for (const t of data || []) {
    try {
      await imprimer(t);
      await sb.from("telegrammes").update({ statut: "printed" }).eq("id", t.id);
      console.log("Imprimé:", t.prenom, "—", (t.texte || "").slice(0, 40));
    } catch (e) {
      console.error("Impression échouée (on réessaiera):", e.message);
      break; // imprimante indispo → on retentera au prochain tour
    }
  }
}

console.log("Agent Télégramme démarré. Ctrl+C pour arrêter.");
await tour();
setInterval(tour, POLL_MS);
