import { sb } from "./supabaseFpv.js";

/* Web Push côté produit « Faire-part Vivant » (VAPID partagé). */
const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function toU8(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupporte() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID
  );
}

async function swReg() {
  // Le service worker (scope de l'app) gère la réception des push.
  const reg = await navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js");
  await navigator.serviceWorker.ready;
  return reg;
}

export async function estAbonne() {
  if (!pushSupporte()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && (await reg.pushManager.getSubscription());
  return !!sub;
}

/* Demande la permission, s'abonne et enregistre pour CETTE invitation. */
export async function abonner(invitationId) {
  if (!pushSupporte()) throw new Error("Notifications non disponibles sur cet appareil.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission refusée.");
  const reg = await swReg();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toU8(VAPID) });
  const { error } = await sb.from("fpv_push_subscriptions").insert({ invitation_id: invitationId, subscription: sub.toJSON() });
  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) throw error;
  return true;
}
