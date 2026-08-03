# Le Télégramme — agent d'impression

Ce petit programme fait le pont entre l'app et une **imprimante thermique** :
quand un invité envoie un télégramme depuis le site, il s'imprime en vrai.

## Matériel (~85 €)

- Une **imprimante thermique ESC/POS** (rouleau 58 ou 80 mm), en **USB** ou **réseau/TCP**
  (marques compatibles : Epson TM, Star, et la plupart des clones « POS-58/80 »).
- Un **Raspberry Pi** (ou n'importe quel laptop) avec Node.js 18+.
- Du papier thermique.

## Installation

```bash
cd tools/telegramme-agent
npm install
```

## Configuration (variables d'environnement)

| Variable | Exemple | Rôle |
|---|---|---|
| `SUPABASE_URL` | `https://lmmnbtcolboomdpfprxs.supabase.co` | projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` | clé **service_role** (Supabase → Project Settings → API). **Reste sur cette machine, jamais dans le navigateur.** |
| `PRINTER_TYPE` | `epson` ou `star` | jeu de commandes |
| `PRINTER_IFACE` | `printer:auto`, `tcp://192.168.1.50`, `/dev/usb/lp0` | connexion imprimante |
| `SITE_URL` | `https://francoisleterrier-lab.github.io/mariage-virginie-francois/` | pour le QR imprimé (renvoie vers l'album) |
| `POLL_MS` | `4000` | fréquence de vérification |

Exemple :

```bash
export SUPABASE_URL="https://lmmnbtcolboomdpfprxs.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
export PRINTER_TYPE="epson"
export PRINTER_IFACE="printer:auto"
export SITE_URL="https://francoisleterrier-lab.github.io/mariage-virginie-francois/"
npm start
```

## Le jour J

1. Branche l'imprimante, lance `npm start` (l'agent affiche « démarré »).
2. Dans l'admin du site → active **Le Télégramme** (case à cocher dans la section).
3. Les invités écrivent leurs mots → ils s'impriment tout seuls et passent en `printed`.

Si l'imprimante est débranchée, l'agent réessaie automatiquement au tour suivant :
aucun télégramme n'est perdu.
