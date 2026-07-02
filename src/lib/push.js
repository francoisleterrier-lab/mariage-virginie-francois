import { supabase } from "./supabase.js";

/* Convertit la clé publique VAPID (base64url) en Uint8Array pour subscribe(). */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/* Le push est-il possible dans ce contexte ? */
export function pushSupporte() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC
  );
}

export function estIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/* PWA installée / lancée en mode standalone ? */
export function estStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/* Abonnement déjà actif sur cet appareil ? */
export async function abonnementActif() {
  if (!pushSupporte()) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!(await reg.pushManager.getSubscription());
}

/* Demande la permission, s'abonne et enregistre en base (sans doublon). */
export async function activerPush(inviteId) {
  if (!pushSupporte()) throw new Error("Notifications non supportées sur cet appareil.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permission refusée.");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const endpoint = sub.toJSON().endpoint;
  const { data: existant } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("invite_id", inviteId)
    .filter("subscription->>endpoint", "eq", endpoint)
    .maybeSingle();

  if (!existant) {
    const { error } = await supabase
      .from("push_subscriptions")
      .insert({ invite_id: inviteId, subscription: sub.toJSON() });
    if (error) throw error;
  }
  return true;
}
