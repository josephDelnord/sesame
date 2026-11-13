# Sésame — Gestion sécurisée de mots de passe clients

« Sésame, ouvre-toi » : application full-stack de génération et recalcul de
mots de passe clients à partir du numéro de série (SN) d'un routeur et d'un
code client.

## Architecture

```
sesame/
├── .env                         # Variables Docker Compose centralisées
├── .env.example                 # Template pour .env
├── Makefile                     # Orchestration (docker, vault, full-up…)
├── docker-compose.yml           # Services backend + frontend + Vault
├── .dockerignore                # Exclusions communes aux builds
├── docker/
│   ├── backend/Dockerfile       # Build multi-étapes (tsc → runtime minimal)
│   ├── frontend/
│   │   ├── Dockerfile           # Build multi-étapes (Vite → nginx)
│   │   └── nginx.conf           # Proxy /api vers le backend
│   └── vault/
│       ├── common.sh            # Fonctions et config partagées
│       ├── entrypoint.sh        # Démarrage Vault + AppRole
│       └── init-approle.sh      # Création AppRole, politique, stockage secret
├── backend/                     # API (Node.js + Express + TypeScript)
│   ├── .env.example             # Configuration à copier en .env
│   ├── data/db.json             # Base JSON (montée depuis l'hôte)
│   └── src/
│       ├── index.ts             # Point d'entrée Express
│       ├── routes/              # Routeurs (records, resolve, regenerate)
│       ├── middleware/          # Authentification admin
│       ├── services/            # password, db, crm, seed, vault
│       │   └── vault.ts         # Intégration HashiCorp Vault
│       ├── tests/               # Tests formule, versions, CRM
│       └── utils/               # Helpers
└── frontend/                    # Interface (React + TypeScript + Vite)
    ├── index.html               # Polices + thème
    ├── .env.example             # VITE_API_URL
    └── src/
        ├── App.tsx              # Layout principal
        ├── main.tsx             # Point d'entrée React
        ├── services/api.ts      # Client HTTP typé
        ├── components/
        │   ├── PasswordForm.tsx
        │   └── ThemeToggle.tsx   # Thème clair/sombre
        └── styles/global.css    # Variables CSS des thèmes
```

## Configuration

### Fichier `.env` à la racine
Le projet utilise un **fichier `.env` centralisé** pour les variables Docker Compose.

**Pour commencer** :
```bash
cp .env.example .env  # Copiez le template
# Editez .env selon vos besoins
```

**Variables disponibles** (`.env.example`) :
```ini
# Ports des services
FRONTEND_PORT=3000
BACKEND_PORT=4000
VAULT_PORT=8200

# Adresse Vault (dev : local, prod : externe)
VAULT_ADDR=http://0.0.0.0:8200
```

**Personnalisation** : Modifiez ces valeurs avant de lancer `make docker-up`.
> ⚠️ **Ne versionnez pas** `.env` (il est dans `.gitignore`). Utilisez `.env.example` comme référence.

### Factorisation
- **docker-compose.yml** : Utilise des [extensions YAML](https://yaml.org/spec/1.2/spec.html#id2765878) (`x-`) pour éviter la duplication de configuration Vault
- **Scripts Vault** : `common.sh` contient les fonctions réutilisables (attente, génération de tokens, etc.)
- **Makefile** : Variables centralisées et fonction `VAULT_EXEC` pour les commandes Docker

### Profils Docker Compose

Le projet utilise les **profils** pour séparer les environnements :

| Profil | Services | Usage |
|--------|----------|-------|
| `dev` | Vault local | Développement avec Vault en mode dev |
| `test` | Vault + backend | Tests d'intégration |
| `backend` | Backend | Toujours activé |
| `frontend` | Frontend | Toujours activé |

**Commandes selon l'environnement :**

```bash
# Développement (Vault local + backend + frontend)
make dev-up
# ou : DOCKER_PROFILES="dev backend frontend" make docker-up

# Tests d'intégration (Vault + backend pour les tests)
make docker-test-up

# Production (backend + frontend uniquement, Vault externe)
make prod-up
# ou : DOCKER_PROFILES="backend frontend" make docker-up

# Par défaut (utilise tous les profils définis dans DOCKER_PROFILES)
make docker-up
```

**Pour production :** Configurez `VAULT_ADDR` dans `.env` pour pointer vers votre Vault externe :
```ini
VAULT_ADDR=https://vault.prod.internal:8200
```

**Pour les tests :** Le profil `test` active Vault et backend pour permettre l'exécution des tests d'intégration.

## Principe

Le mot de passe est **déterministe et recalculable** :

```
password = FORMULE(SHA-256(SN :: code_client [:: v<version>]))
```

- SHA-256 combine le **numéro de série** et le **code client**
- Transformation en chaîne de 12 caractères (min 8) avec : 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
- Même couple (SN, code client) → même mot de passe pour une version donnée
- **Version** : permet la rotation (incrémentation pour régénération admin)

## Endpoints (backend, port 4000)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/health` | Vérification santé |
| GET | `/api/records` | Liste des enregistrements |
| POST | `/api/records` | Création d'un enregistrement |
| POST | `/api/resolve` | Résolution partielle + recalcul mot de passe |
| POST | `/api/records/:id/regenerate` | Régénération admin (version +1) |

`POST /api/resolve` accepte `{ serialNumber?, clientCode?, ip? }` :
- Recherche en base locale → CRM si non trouvé → recalcul
- Erreurs : `401` (token invalide), `404` (inconnu), `500` (Vault non disponible)

## Régénération admin

`POST /api/records/:id/regenerate` avec header `Authorization: Bearer <ADMIN_TOKEN>`
- Incrémente `passwordVersion` → nouveau mot de passe
- Toujours recalculable avec (SN, code client, version)
- **`ADMIN_TOKEN` est stocké dans Vault** à `secret/data/sesame` (avec `password_secret_key`)

## Connecteur CRM

Flux : `données partielles → base locale → [non trouvé] → CRM → import → recalcul`

Configuration (`backend/.env`) :
- `CRM_API_URL` : URL base (désactive le connecteur si absent)
- `CRM_SEARCH_PATH` : chemin de recherche (défaut `/search`)
- `CRM_API_KEY` : clé API (optionnelle)

Contrat : `POST {CRM_API_URL}{CRM_SEARCH_PATH}` avec `{ serialNumber?, clientCode?, ip? }`
→ Réponse : `200 + {record: {serialNumber, clientCode, ip}}` ou `404`

## HashiCorp Vault

**Obligatoire** pour stocker le `PASSWORD_SECRET_KEY`.

### Architecture Vault
- **Vault** : `http://localhost:8200` (dev) / URL personnalisée (prod)
- **AppRole** : authentification backend (Role ID + Secret ID via fichiers)
- **Stockage** : KV v2 à `secret/data/sesame` (chemin logique) contenant :
  - `password_secret_key` : sel pour la génération des mots de passe
  - `admin_token` : token d'administration pour la régénération
- **Sécurité** : token root **aléatoire** à chaque démarrage, **jamais affiché dans les commandes Makefile**

> ℹ️ **Note sur KV v1** : Le script d'init ne stocke **plus** en KV v1. Tous les secrets sont en KV v2 à `secret/data/sesame`.

### Démarrage

```bash
# Développement : tout en une commande (Vault local + backend + frontend)
make full-up

# Développement : étape par étape
make vault-up       # Démarre Vault local + AppRole
make vault-secrets  # Génère et stocke PASSWORD_SECRET_KEY
make dev-up         # Démarre backend + frontend (avec Vault)

# Production : backend + frontend uniquement (Vault externe requis)
make prod-up
```

> ⚠️ **Vault est obligatoire** : en développement, utilisez `make dev-up` ou `make full-up`. En production, configurez `VAULT_ADDR` vers votre Vault externe avant `make prod-up`.

### Commandes Makefile

| Commande | Description |
|----------|-------------|
| `make docker` | Construit les images + démarre les conteneurs |
| `make docker-up` | Démarre backend + frontend |
| `make docker-down` | Arrête les conteneurs |
| `make docker-logs` | Suit les logs |
| `make vault-up` | Démarre Vault + AppRole |
| `make vault-down` | Arrête Vault |
| `make vault-secrets` | Régénère le PASSWORD_SECRET_KEY |
| `make vault-shell` | **Shell admin** (nécessite accès Docker) |
| `make full-up` | Démarre tout en une commande |
| `make kill-port PORT=N` | Libère un port occupé |

### Accès à Vault

| Accès | URL | Authentification |
|-------|-----|------------------|
| **Interface Sésame** | `http://localhost:3000` | - |
| **API Sésame** | `http://localhost:4000` | - |
| **UI Vault** | `http://localhost:8200` | Token root via `docker exec sesame-vault-1 cat /vault/secrets/vault_root_token` |
| **Shell Vault** | - | `make vault-shell` (nécessite accès Docker) |

Exemples dans le shell Vault :
```bash
vault kv list secret/data/
vault kv get secret/data/sesame
vault status
```

### Sécurité
- Le token root **n'est jamais affiché** dans le terminal par les commandes Makefile
- L'accès admin (`vault-shell`) nécessite **accès Docker** sur la machine
- Le backend utilise **AppRole** (pas le token root)
- En production : désactivez le token root, utilisez uniquement AppRole

### Configuration production

```ini
# backend/.env
VAULT_ADDR=https://vault.prod.internal:8200
VAULT_ROLE_ID_FILE=/run/secrets/vault_role_id
VAULT_SECRET_ID_FILE=/run/secrets/vault_secret_id
```

## Développement local

### Avec Docker (recommandé)
```bash
# Démarrage complet (Vault local + backend + frontend)
make full-up

# Ou démarrer séparément
make dev-up  # Démarre tous les services (dev)
```

- Configuration lue depuis `.env` (variables Docker Compose) et `backend/.env`
- Base `backend/data/db.json` montée depuis l'hôte
- Ports personnalisables : `FRONTEND_PORT=8080 BACKEND_PORT=14000 make docker-up`
- Port occupé ? : `make kill-port PORT=N`

> ℹ️ **Note** : `make full-up` = `make vault-init` + `make dev-up`

### Sans Docker
```bash
# Backend — http://localhost:4000
cd backend && npm install && npm run dev

# Frontend — http://localhost:3000
cd frontend && npm install && npm run dev
```

Configuration :
```bash
cp backend/.env.example backend/.env
```

> ⚠️ **Important** : en mode dev sans Docker, Vault n'est pas disponible.

## Utilisation

1. Remplir un ou plusieurs champs : SN, code client, IP
2. Valider : les champs manquants sont complétés depuis la base
3. Le mot de passe s'affiche avec options **copier**, **masquer**, **afficher**
4. « Régénérer (admin) » : après saisie du code admin, nouveau mot de passe généré

## Interface

Thème « Sésame, ouvre-toi » avec bascule clair/sombre.
- Choix mémorisé dans `localStorage`
- Thème initial selon `prefers-color-scheme` du système

## Tests

### Tests unitaires
```bash
# Exécuter les tests unitaires (sans dépendance externe)
cd backend && npm test

# Ou via Makefile
make test-backend
```

Vérifie : déterminisme, critères, unicité, compatibilité versions, connecteur CRM.

### Tests d'intégration

Les tests d'intégration vérifient la connexion avec **HashiCorp Vault** :
- Connexion au serveur Vault
- Récupération du `PASSWORD_SECRET_KEY` via AppRole
- Validation de la configuration Vault

```bash
# Démarrer les services pour les tests (Vault + backend)
make docker-test-up

# Exécuter les tests d'intégration
make test-integration

# Tout en une commande
make test-all

# Arrêter les services de test
make docker-test-down
```

> ⚠️ **Prérequis** : Les tests d'intégration nécessitent Docker et le profil `test` activé.

**Fichiers de test :**
- `backend/tests/password.test.ts` — Tests unitaires (sans Vault)
- `backend/tests/crm.test.ts` — Tests unitaires CRM
- `backend/tests/integration/vault.test.ts` — Tests d'intégration Vault ⭐ NOUVEAU

## Notes

- Persistance : stockage JSON (`backend/data/db.json`) via `db.ts` → remplaçable par SQLite/PostgreSQL
- Les mots de passe **ne sont pas stockés** : toujours recalculés à partir de (SN, code client, version)
- Fichiers `.env` **non versionnés** (seuls `.env.example` le sont)
- En Docker : frontend → API via proxy nginx ; en dev : via proxy Vite
- Vault : conteneur démarré automatiquement avec Docker Compose
