# Sésame — Gestion sécurisée de mots de passe clients

Application full-stack de génération et recalcul **déterministe** de mots de passe clients à partir du numéro de série (SN) d'un routeur et d'un code client.

```
password = FORMULE(SHA-256(SN :: code_client [:: v<version>]))
```

## Architecture

```
sesame/
├── .env                      # Variables Docker Compose
├── .env.example              # Template
├── Makefile                  # Orchestration Docker
├── docker-compose.yml        # Services (backend + frontend + Vault)
├── docker/
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   └── vault/                # Scripts d'initialisation
│       ├── common.sh
│       ├── entrypoint.sh
│       └── init-approle.sh
├── backend/
│   ├── .env.example
│   ├── data/db.json
│   └── src/
│       ├── index.ts
│       ├── routes/
│       ├── middleware/
│       ├── services/        # Include vault.ts
│       └── tests/
└── frontend/
    ├── .env.example
    └── src/
        ├── App.tsx
        ├── main.tsx
        └── components/
```

## Configuration

### Fichier `.env` à la racine
```ini
FRONTEND_PORT=3000
BACKEND_PORT=4000
VAULT_PORT=8200
VAULT_ADDR=http://vault:8200
```

Copiez le template : `cp .env.example .env`

### Profils Docker Compose

| Profil | Services | Usage |
|--------|----------|-------|
| `dev` | Vault local | Développement |
| `test` | Vault + backend | Tests d'intégration |
| `backend` | Backend | Production |
| `frontend` | Frontend | Production |

## Démarrage

### Développement (avec Vault local)
```bash
make full-up      # Tout en une commande (recommandé)
# ou
make dev-up       # Démarre tous les services
make vault-shell  # Accès admin à Vault
```

### Production (Vault externe requis)
```bash
make prod-up      # Backend + frontend uniquement
```

### Sans Docker
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Endpoints (port 4000)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé de l'API |
| GET | `/api/records` | Liste des enregistrements |
| POST | `/api/records` | Créer un enregistrement |
| POST | `/api/resolve` | Résolution partielle + recalcul |
| POST | `/api/records/:id/regenerate` | Régénération admin (version +1) |

## Utilisation

1. Remplir un ou plusieurs champs : SN, code client, IP
2. Valider : les champs manquants sont complétés depuis la base
3. Le mot de passe s'affiche avec options **copier**, **masquer**, **afficher**
4. « Régénérer (admin) » : nécessite l'ADMIN_TOKEN pour générer un nouveau mot de passe

## HashiCorp Vault

**Obligatoire** pour stocker les secrets :
- `PASSWORD_SECRET_KEY` (64 bytes hex)
- `ADMIN_TOKEN` (32 bytes hex)

Chemin de stockage : `secret/data/sesame` (KV v2)

Voir la documentation complète : [docs/VAULT_SECRETS.md](docs/VAULT_SECRETS.md)

## Connecteur CRM (optionnel)

Flux : `données partielles → base locale → CRM → import → recalcul`

Configuration (`backend/.env`) :
```ini
CRM_API_URL=
CRM_SEARCH_PATH=/search
CRM_API_KEY=
```

## Tests

```bash
make test-backend      # Tests unitaires
make test-integration  # Tests avec Vault
make test-all          # Tous les tests
```

## Notes

- Mots de passe **non stockés** : toujours recalculés à partir de (SN, code client, version)
- Fichiers `.env` **non versionnés** (seuls `.env.example` le sont)
- Vault : configuré automatiquement avec Docker Compose (profils `dev` ou `test`)
- Thème : bascule clair/sombre avec mémorisation dans `localStorage`
