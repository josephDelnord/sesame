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

`POST /api/resolve` accepte n'importe quelle combinaison partielle de
`{ serialNumber, clientCode, ip }` : la base est interrogée pour retrouver
l'enregistrement complet, puis le mot de passe est recalculé.

## Démarrage

### Backend (VM 1)

```bash
cd backend
npm install
npm run dev     # http://localhost:4000
```

La base est initialisée et alimentée automatiquement au démarrage
(voir `src/seed.ts`) — équivalent du back-end CRM qui génère les mots
de passe à la création des clients.

### Frontend (VM 2)

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

Le serveur de développement Vite proxifie `/api` vers `http://localhost:4000`.
Pour une autre machine : adapter `VITE_API_URL` dans `frontend/.env`.

### Utilisation

1. Remplir un ou plusieurs champs : SN, code client, IP.
2. Valider : les champs manquants sont complétés depuis la base.
3. Le mot de passe recalculé s'affiche, avec options **copier**,
   **masquer** et **afficher**.

## Tests

```bash
cd backend && npm test
```

Vérifie le déterminisme du mot de passe, le respect des critères et
l'unicité par SN / code client.

## Notes

- La persistance utilise un stockage JSON simple (`backend/data/db.json`),
  isolé derrière le module `db.ts` : il peut être remplacé par SQLite ou
  PostgreSQL sans toucher au reste du code.
- Les mots de passe ne sont pas stockés en base : ils sont toujours
  recalculés à partir du SN et du code client.
