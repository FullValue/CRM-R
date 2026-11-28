# CRM centralisé — Maison Maya · Atelier Amari · Parfumerie Mobile

Réalisation du cahier des charges v1.0 (25 novembre 2026). Trois espaces dans une
même interface, une vue d'ensemble administrateur et un parcours vendeur mobile.

Stack : Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind v4 ·
shadcn/ui (Radix) · Prisma 6 (SQLite en local) · decimal.js · Leaflet · Recharts · Vitest.

## Démarrage

```bash
npm install
cp .env.example .env        # puis renseigner CHIFFREMENT_CLE (openssl rand -base64 32)
npm run db:push             # crée la base SQLite locale (prisma/dev.db)
npm run db:seed             # jeu de démonstration FICTIF
npm run dev                 # http://localhost:3000
```

Réinitialiser la base locale : `npm run db:reset` (efface tout puis rejoue le seed).

### Comptes de démonstration (seed, données fictives)

| Compte | Mot de passe | Rôle |
|---|---|---|
| direction@crm.test | demo-direction-2026 | Administrateur désigné, 3 espaces |
| maya@crm.test | demo-maya-2026 | Administrateur Maison Maya |
| amari@crm.test | demo-amari-2026 | Administrateur Atelier Amari |
| parfumerie@crm.test | demo-parfumerie-2026 | Administrateur Parfumerie Mobile |
| vendeur@crm.test | demo-vendeur-2026 | Vendeur |
| vendeuse@crm.test | demo-vendeuse-2026 | Vendeur, prix modifiable |

À supprimer ou changer avant toute mise en service.

### Projet placé sur un Bureau synchronisé iCloud (macOS)

iCloud ralentit fortement la lecture des dizaines de milliers de fichiers de
`node_modules`. Installez les dépendances hors iCloud et liez-les :

```bash
mkdir -p ~/.cache/crm-centralise && cp package.json package-lock.json ~/.cache/crm-centralise/
(cd ~/.cache/crm-centralise && npm install)
ln -sfn ~/.cache/crm-centralise/node_modules node_modules
```

`next.config.ts` adapte automatiquement la racine Turbopack à ce lien.

## Tests

```bash
npm test                  # moteur de calcul : exemples chiffrés du cahier des charges
npm run test:integration  # services sur base dédiée prisma/recette.db (R04, R05, R06, R07, R09, R10, R11, R12)
npm run lint && npm run typecheck
```

## Correspondance avec le cahier des charges

| Exigence | Où |
|---|---|
| ACC-01/02 comptes, espaces, droits, révocation | `lib/auth/*`, layouts `app/(admin)/[espace]`, `/admin/utilisateurs` |
| STK-01..03 références, formats, mouvements, intégrité | `/[espace]/catalogue`, `/[espace]/stock`, `lib/services/stock.ts` |
| MAY-01/02 inventaire et migration contrôlée | `/maya/import`, `lib/import.ts` |
| Coûts de revient Maya (moteur Maya OS) | `/maya/couts`, `lib/calcul/coutMaya.ts` |
| AMA-01..04 dépenses, coûts fixes, parts, vue financière | `/amari/*`, `lib/services/depenses.ts`, `lib/calcul/repartition.ts` |
| PM-01..04 catalogue, ventes, corrections, journal | `/pm/ventes`, `lib/services/ventes.ts` |
| FIN-01..03 prix de touche, marge, couverture, fonds de roulement | `/pm/rentabilite`, `/pm/tresorerie`, `lib/calcul/vente.ts`, `lib/calcul/tresorerie.ts` |
| VEN-01/02 saisie mobile, relance sans doublon | `/vendeur`, `components/vente/formulaire-vente.tsx` |
| GEO-01..03 zone proposée, provenance, carte | `/pm/zones`, `lib/calcul/geo.ts` |
| PIL-01..03 tableaux de bord, définitions, dates | `/tableau-de-bord`, `/pm/tableau-de-bord` |
| SHP-01..04 liaisons, file d'ajustements, notifications | `/admin/shopify`, `lib/shopify/*`, `app/api/shopify/webhook` |
| LIV-01..03 créneaux, message WhatsApp, livraison | `/pm/livraisons`, `/livraison`, `/api/public/creneaux` |
| DAT-01, SEC-01 centimes, dates distinctes, journal, secrets | `prisma/schema.prisma`, `lib/audit.ts`, `lib/chiffrement.ts`, `/admin/journal` |

Les décisions D01 à D12 sont prises avec les modalités proposées par le cahier
des charges, réglables dans `/admin/reglages` quand elles sont paramétrables.

## Hors périmètre de cette version

- Synchronisation Shopify testée sans boutique réelle : le code (lecture, rapprochement
  par SKU, ajustements, notifications HMAC) attend un domaine et un jeton.
- Import des commandes Shopify et sources de CA Maison Maya / Atelier Amari (D08) :
  la vue d'ensemble signale un total partiel.
- Commandes B2B, clients et grilles tarifaires Maya OS : à arbitrer (D01).
- Authentification renforcée administrateur, hors-ligne complet, sauvegardes (D11, D12).
## Base de production

Le build Vercel génère le client Prisma PostgreSQL à partir du même schéma que
le client SQLite local. Les variables de connexion du projet Vercel sont
utilisées directement par le build et par l’application.

Le build de production Vercel (`VERCEL_ENV=production`) applique lui-même ces
migrations (`prisma migrate deploy`) avant de compiler : une nouvelle colonne
existe donc toujours en base avant que le code qui la lit soit en ligne. Les
déploiements d'aperçu ne migrent pas.

Sur une production dont le catalogue Parfumerie Mobile est vide, ce même build
installe une seule fois le jeu de démonstration (`prisma/remplir-prod.ts`) :
les 286 références du fichier fournisseur `prisma/donnees/vanora-parfums.csv`
et des données fictives (stocks, coûts, ventes, tournée, zones, trésorerie,
Maya, Amari). Aucun compte administrateur de démonstration n'est créé ; les
deux vendeurs fictifs ont un mot de passe aléatoire. `CRM_DEMO_PROD=0` désactive
cette étape ; le repère `demo.prod` dans les réglages empêche toute réinstallation.

La commande `npm run db:migrate:prod` applique les migrations versionnées de
`prisma/postgresql/migrations` à la connexion PostgreSQL fournie dans
l’environnement. L’initialisation crée les trois activités et les emplacements
de configuration Shopify. Le seed de démonstration est réservé à la recette
locale.
