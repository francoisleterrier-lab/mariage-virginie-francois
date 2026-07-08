/// <reference lib="webworker" />
/* Service worker (stratégie injectManifest) :
   - précache du shell (HTML/CSS/JS/fonts) via Workbox
   - stale-while-revalidate pour les médias (images, vidéo) et Google Fonts
   - réception des notifications push (Web Push / VAPID)
*/
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

// Mise à jour immédiate : le nouveau SW s'active et prend le contrôle des
// pages sans attendre la fermeture de tous les onglets → plus de version figée.
self.skipWaiting();
clientsClaim();

// eslint-disable-next-line no-undef
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Médias statiques (photos, icônes, polices) : SWR => dispo hors-ligne après
// la 1re visite, rafraîchis en arrière-plan.
// IMPORTANT : on NE met PAS en cache la vidéo ni l'audio. Ces éléments <video>/
// <audio> sont lus via des requêtes Range (206 Partial Content) ; un cache
// StaleWhileRevalidate renvoie la réponse 200 complète et Safari/iOS refuse
// alors de lire le média (l'intro « ne fonctionne plus » aux visites suivantes).
// On les laisse passer directement au réseau pour préserver le support Range.
registerRoute(
  ({ request }) => ["image", "font"].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: "medias-vf",
    plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
);

// Google Fonts (feuille + fichiers woff2).
registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts" })
);

// ---------- Web Push ----------
self.addEventListener("push", (event) => {
  let data = { title: "Virginie & François", body: "", url: "./" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const options = {
    body: data.body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: "vf-2028",
    data: { url: data.url || "./" },
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = event.notification.data?.url || "./";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const client of liste) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(cible);
    })
  );
});

// Permet à la page de forcer l'activation d'une nouvelle version.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
