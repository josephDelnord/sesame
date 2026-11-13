# Sésame — Gestion sécurisée de mots de passe clients

« Sésame, ouvre-toi » : application full-stack de génération et recalcul de
mots de passe clients à partir du numéro de série (SN) d'un routeur et d'un
code client.

## Architecture

```
sesame/
├── backend/                 # VM 1 — API "CRM" (Node.js + Express + TypeScript)
│   └── src/
│       ├── index.ts         # Serveur HTTP + routes
│       ├── password.ts      # Formule de génération (hash recalculable)
│       ├── password.test.ts # Tests de la formule
│       ├── db.ts            # Base de données (stockage JSON)
│       └── seed.ts          # Données d'exemple
└── frontend/                # VM 2 — Interface utilisateur (React + TypeScript + Vite)
    └── src/
        ├── App.tsx
        └── components/PasswordForm.tsx
```

## Principe

Le mot de passe est déterministe et recalculable :

`password = FORMULE( SHA-256( SN :: code_client ) )`

- Le hash SHA-256 combine le **numéro de série du routeur** et le **code client**.
- Le hash est transformé en chaîne texte conforme aux critères prédéfinis
  (12 caractères, au moins une majuscule, une minuscule, un chiffre et un
  caractère spécial — donc bien supérieur au minimum de 8 caractères).
- Le même couple (SN, code client) produit **toujours** le même mot de passe :
  il peut donc être régénéré sur la VM 2 à partir de données partielles
  (IP seule, code client seul, etc.) via la base de données.

## Endpoints (backend, port 4000)

| Méthode | Route           | Description                                              |
|---------|-----------------|---------------------------------------------------------|
| GET     | /api/health     | Vérification que l'API est en ligne                     |
| GET     | /api/records    | Liste des enregistrements                                |
| POST    | /api/records    | Création d'un enregistrement (SN, code client, IP)      |
| POST    | /api/resolve    | Résout les champs manquants et recalcule le mot de passe |
| POST    | /api/records/:id/regenerate | Régénération admin : calcule un nouveau mot de passe |

`POST /api/resolve` accepte n'importe quelle combinaison partielle de
`{ serialNumber, clientCode, ip }` : la base est interrogée pour retrouver
l'enregistrement complet, puis le mot de passe est recalculé.

## Régénération d'un mot de passe (admin)

Le mot de passe est déterministe ; recalculer donne donc toujours le même
résultat. Pour permettre à un administrateur de générer **un autre** mot de
passe (compromission, rotation périodique…), chaque enregistrement porte un
numéro de version (`passwordVersion`, 0 = formule d'origine compatible avec
les mots de passe existants) :

```
password = FORMULE( SHA-256( SN :: code_client [:: v<version>] ) )
```

`POST /api/records/:id/regenerate` (en-tête `Authorization: Bearer
<ADMIN_TOKEN>`) incrémente la version stockée : le mot de passe suivant est
différent, mais reste recalculable à partir du même couple (SN, code client)
et de la version courante. Les réponses d'erreur :

- `503` : `ADMIN_TOKEN` non configuré côté serveur (fonctionnalité désactivée) ;
- `401` : code administrateur invalide ;
- `404` : identifiant inconnu.

La variable `ADMIN_TOKEN` est définie dans `backend/.env` (non versionné). Le
frontend affiche un bouton « Régénérer (admin) » dès qu'un mot de passe est
affiché, avec saisie du code administrateur.

## Connecteur CRM de l'entreprise

Si l'enregistrement n'est pas trouvé dans la base locale, le backend peut
aller chercher les informations (`serialNumber`, `clientCode`, `ip`) dans le
CRM de l'entreprise, via un connecteur HTTP configurable
(`backend/src/crm.ts`). L'équipement trouvé est importé dans la base locale
(sans doublon) avant recalcul du mot de passe.

Flux de `/api/resolve` :

```
données partielles -> base locale -> [non trouvé] -> CRM -> import -> recalcul
                                     (CRM injoignable -> 502)
```

Configuration (`backend/.env.example`) :

| Variable         | Rôle                                                        |
|------------------|-------------------------------------------------------------|
| `CRM_API_URL`    | URL de base du CRM ; si absente, le connecteur est désactivé |
| `CRM_SEARCH_PATH`| Chemin de recherche (par défaut `/search`)                   |
| `CRM_API_KEY`    | Clé d'API envoyée en `Authorization: Bearer ...` (optionnel) |

Contrat attendu du CRM : `POST {CRM_API_URL}{CRM_SEARCH_PATH}` reçoit
`{ serialNumber?, clientCode?, ip? }` et répond:

- `200` + `{ "record": { "serialNumber", "clientCode", "ip" } }` si trouvé ;
- `200` + `{ "record": null }` ou `404` si aucun équipement ne correspond.

Si les deux chemins échouent, la réponse est `404` ; si le CRM renvoie une
erreur ou est injoignable, la réponse est `502`.

## Démarrage

Toutes les commandes s'exécutent depuis la racine du projet via le
`Makefile` (`make` seul affiche l'aide) :

```bash
make install      # dépendances backend + frontend
make dev          # backend (VM 1, port 4000) + frontend (VM 2, port 5173)
```

Démarrage séparé si les VM sont distinctes :

```bash
make dev-backend    # uniquement l'API   — http://localhost:4000
make dev-frontend   # uniquement l'UI    — http://localhost:5173
```

Au premier lancement, copier puis adapter la configuration locale
(fichiers non versionnés) :

```bash
cp backend/.env.example backend/.env
```

La base est initialisée et alimentée automatiquement au démarrage
(`make seed` la réinitialise) — équivalent du back-end CRM qui génère
les mots de passe à la création des clients.

Le serveur de développement Vite proxifie `/api` vers `http://localhost:4000`.
Pour une autre machine : adapter `VITE_API_URL` dans `frontend/.env`
(voir `frontend/.env.example`).

### Production

```bash
make serve    # compile (make build) puis démarre l'API compilée (port 4000)
```

### Utilisation

1. Remplir un ou plusieurs champs : SN, code client, IP.
2. Valider : les champs manquants sont complétés depuis la base.
3. Le mot de passe recalculé s'affiche, avec options **copier**,
   **masquer** et **afficher**.
4. « Régénérer (admin) » : après saisie du code administrateur, un nouveau
   mot de passe est calculé (version +1) et affiché en remplacement.

## Tests

```bash
make test
```

Vérifie le déterminisme du mot de passe, le respect des critères,
l'unicité par SN / code client, la compatibilité des versions et le
connecteur CRM.

## Notes

- La persistance utilise un stockage JSON simple (`backend/data/db.json`),
  isolé derrière le module `db.ts` : il peut être remplacé par SQLite ou
  PostgreSQL sans toucher au reste du code.
- Les mots de passe ne sont pas stockés en base : ils sont toujours
  recalculés à partir du SN et du code client.
