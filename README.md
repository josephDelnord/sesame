# Sésame — Gestion sécurisée de mots de passe clients

Application full-stack de génération et recalcul **déterministe** de mots de passe clients :

```text
password = FORMULE(SHA-256(SN :: code_client [:: v<version>]))
```

## Architecture

```text
sesame/
├── .env                      # Configuration Docker Compose
├── Makefile                  # Orchestration
├── docker-compose.yml        # Services
├── backend/
│   ├── .env                  # Configuration locale
│   └── src/
└── frontend/
    └── src/
```

## Configuration

### À la racine

```ini
FRONTEND_PORT=3000
BACKEND_PORT=4000
VAULT_PORT=8200
VAULT_ADDR=http://vault:8200
```

Copiez le template : `cp .env.example .env`

### Backend

Configuration dans `backend/.env` :
```ini
PORT=4000
CRM_API_URL=
CRM_SEARCH_PATH=/search
CRM_API_KEY=
```

## Profils Docker Compose

| Profil | Services | Usage |
|--------|----------|-------|
| `dev` | Vault local | Développement |
| `test` | Vault + backend | Tests d'intégration |
| `backend` | Backend | Production |
| `frontend` | Frontend | Production |

## Démarrage

### Développement (avec Vault local)

```bash
make full-up      # Démarre tout : Vault + backend + frontend (recommandé)
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

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Santé de l'API |
| GET | `/api/records` | Liste des enregistrements |
| POST | `/api/records` | Créer un enregistrement |
| POST | `/api/resolve` | Résolution partielle + recalcul |
| POST | `/api/records/:id/regenerate` | Régénération admin (version +1) |

## Utilisation

1. Remplir un ou plusieurs champs : SN, code client, IP
2. Valider : les champs manquants sont complétés depuis la base locale
3. Le mot de passe s'affiche avec options **copier**, **masquer**, **afficher**
4. « Régénérer (admin) » : nécessite l'ADMIN_TOKEN pour générer un nouveau mot de passe

## HashiCorp Vault

**Obligatoire** pour stocker les secrets :
- `PASSWORD_SECRET_KEY` (64 bytes hex) — sel pour la génération des mots de passe
- `ADMIN_TOKEN` (32 bytes hex) — token pour la régénération admin

Chemin de stockage : `secret/data/sesame` (KV v2)

Documentation complète : [docs/VAULT_SECRETS.md](docs/VAULT_SECRETS.md)

## Connecteur CRM (optionnel)

Flux : `données partielles → base locale → CRM → import → recalcul`

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
