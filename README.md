# Sésame — Gestion sécurisée de mots de passe clients

« Sésame, ouvre-toi » : application full-stack de génération et recalcul de
mots de passe clients à partir du numéro de série (SN) d'un routeur et d'un
code client.

## Architecture

```
sesame/
├── Makefile                 # Orchestration Docker (make docker, vault-up, full-up…)
├── docker-compose.yml       # Services sesame-backend, sesame-frontend
├── docker-compose.override.yml # Configuration Vault pour le développement
├── .dockerignore            # Exclusions communes aux builds (contexte racine)
├── docker/                  # Configuration Docker centralisée
│   ├── backend/Dockerfile   # Build multi-étapes (tsc → runtime minimal)
│   ├── frontend/
│   │   ├── Dockerfile       # Build multi-étapes (Vite → nginx)
│   │   └── nginx.conf       # Sert le build et proxifie /api vers le backend
│   └── vault/               # Configuration Vault
│       ├── entrypoint.sh    # Démarrage Vault + initialisation AppRole
│       └── init-approle.sh  # Création AppRole, politique, stockage du secret
├── backend/                 # VM 1 — API "CRM" (Node.js + Express + TypeScript)
│   ├── .env.example         # Configuration documentée (copier en .env)
│   ├── data/db.json         # Base JSON (montée depuis l'hôte en Docker)
│   └── src/
│       ├── index.ts         # Point d'entrée : serveur Express + montage des routes
│       ├── routes/          # Un routeur par domaine (records, resolve, regenerate)
│       ├── middleware/      # Authentification administrateur
│       ├── services/        # password (formule), db, crm, seed, vault
│       │   └── vault.ts     # Intégration HashiCorp Vault (AppRole)
│       ├── tests/           # Tests de la formule, des versions et du CRM
│       └── utils/           # Aides partageables (lecture de champs)
└── frontend/                # VM 2 — Interface utilisateur (React + TypeScript + Vite)
    ├── index.html           # Polices + application du thème avant rendu
    ├── .env.example         # VITE_API_URL (vide = même origine)
    └── src/
        ├── App.tsx          # En-tête, assemblage des composants, pied de page
        ├── main.tsx         # Point d'entrée React
        ├── services/api.ts  # Client HTTP typé (resolve, regenerate)
        ├── components/
        │   ├── PasswordForm.tsx
        │   └── ThemeToggle.tsx  # Bascule clair/sombre + mémorisation
        └── styles/global.css    # Thème sombre (défaut) et clair en variables CSS
```

## Principe

Le mot de passe est déterministe et recalculable :

`password = FORMULE( SHA-256( SN :: code_client ) )`

- Le hash SHA-256 combine le **numéro de série du routeur** et le **code client**.
- Le hash est transformé en chaîne texte conforme aux critères prédéfinis
  (12 caractères, au moins une majuscule, une minuscule, un chiffre et un
  caractère spécial — donc bien supérieur au minimum de 8 caractères).
- Le même couple (SN, code client) produit **toujours** le même mot de passe
  pour une version donnée (voir « Régénération ») : il peut donc être régénéré
  sur la VM 2 à partir de données partielles (IP seule, code client seul,
  etc.) via la base de données.

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
(`backend/src/services/crm.ts`). L'équipement trouvé est importé dans la base locale
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

Le Makefile orchestrer Docker et Vault. Les commandes npm de développement
restent utilisables directement dans `backend/` et `frontend/`.

### Docker + Vault (recommandé)

```bash
# Démarrage complet (Vault + backend + frontend)
make full-up

# Ou étape par étape
make vault-up       # Démarre Vault uniquement
make vault-secrets  # Génère et stocke le PASSWORD_SECRET_KEY dans Vault
make docker-up      # Démarre backend + frontend

# Autres commandes
make docker         # construit les images puis démarre les conteneurs
make docker-logs    # suit les logs (Ctrl-C pour sortir)
make docker-down    # arrête les conteneurs
make vault-down     # arrête Vault
```

Une fois démarré : interface sur `http://localhost:3000`, API sur
`http://localhost:4000` (testable avec `curl localhost:4000/api/health`).

- `docker-compose.yml` : services `sesame-backend`, `sesame-frontend`
- `docker-compose.override.yml` : service `vault` pour le développement
- La configuration (`ADMIN_TOKEN`, `CRM_*`) est lue depuis `backend/.env` via
  `env_file` — jamais copiée dans l'image.
- La base `backend/data/db.json` est montée depuis la machine hôte :
  supprimez le fichier (ou `rm backend/data/db.json`) pour réinitialiser
  la base, qui se ré-amorce au redémarrage du conteneur.
- Ports personnalisés : `FRONTEND_PORT=8080 BACKEND_PORT=14000 make docker-up`.
- Port déjà occupé hors Docker : `make kill-port PORT=<numéro>`.

> ⚠️ **Vault est obligatoire** : le `PASSWORD_SECRET_KEY` n'est plus stocké dans
> les fichiers de configuration mais dans Vault. Sans Vault, l'application
> ne démarrera pas.

### Développement local (sans Docker)

```bash
# Backend (VM 1) — http://localhost:4000
cd backend && npm install && npm run dev

# Frontend (VM 2) — http://localhost:3000
cd frontend && npm install && npm run dev
```

Au premier lancement, copier puis adapter la configuration locale
(fichiers non versionnés) :

```bash
cp backend/.env.example backend/.env
```

Le serveur de développement Vite proxifie `/api` vers `http://localhost:4000`.
Pour une autre machine : adapter `VITE_API_URL` dans `frontend/.env`
(voir `frontend/.env.example`).

Les conteneurs Docker et les serveurs de dev utilisent les mêmes ports
(4000/3000) et la même base : lancez l'un **ou** l'autre.

### Utilisation

1. Remplir un ou plusieurs champs : SN, code client, IP.
2. Valider : les champs manquants sont complétés depuis la base.
3. Le mot de passe recalculé s'affiche, avec options **copier**,
   **masquer** et **afficher**.
4. « Régénérer (admin) » : après saisie du code administrateur, un nouveau
   mot de passe est calculé (version +1) et affiché en remplacement.

### Interface

L'interface (thème « Sésame, ouvre-toi ») propose un mode sombre (par
défaut) et un mode clair, basculables via le bouton soleil/lune de
l'en-tête. Le choix est mémorisé dans le navigateur (`localStorage`) et
le thème initial suit la préférence du système (`prefers-color-scheme`).

## HashiCorp Vault (stockage sécurisé des secrets)

Sésame utilise **HashiCorp Vault** en environnement de développement pour
stocker le `PASSWORD_SECRET_KEY` de manière sécurisée. Vault est **obligatoire**
et remplace le stockage du secret dans les fichiers de configuration.

### Architecture

- **Vault** (`http://localhost:8200`) : stocke le `PASSWORD_SECRET_KEY`
- **AppRole** : authentification sécurisée du backend (Role ID + Secret ID)
- **KV v2** : le secret est stocké en Key-Value version 2 à
  `secret/data/data/sesame`

### Prérequis

- Docker et Docker Compose installés
- Port `8200` disponible sur `localhost`

### Démarrage complet avec Vault

```bash
# Démarre Vault + initialise AppRole + stocke le secret + backend + frontend
make full-up

# Ou étape par étape
make vault-up      # Démarre Vault
make vault-secrets # Génère et stocke le PASSWORD_SECRET_KEY
make docker-up     # Démarre backend + frontend
```

### Commandes Vault disponibles

| Commande | Description | Accès |
|----------|-------------|-------|
| `make vault-up` | Démarre Vault et initialise AppRole | ✅ Public |
| `make vault-down` | Arrête Vault | ✅ Public |
| `make vault-init` | `vault-up` + `vault-secrets` | ✅ Public |
| `make vault-secrets` | Régénère le PASSWORD_SECRET_KEY | ✅ Public |
| `make full-up` | Démarre tout en une commande | ✅ Public |
| `make vault-shell` | **Shell admin** dans le conteneur Vault | 🔒 Nécessite accès Docker |

### Accès à l'interface web de Vault

1. **URL** : `http://localhost:8200`
2. **Token root** : généré aléatoirement à chaque démarrage
   - Récupérez-le avec :
     ```bash
     docker exec sesame-vault-1 cat /vault/secrets/vault_root_token
     ```

### Accès admin via shell

```bash
make vault-shell
```

Cette commande ouvre un shell dans le conteneur Vault avec :
- `VAULT_ADDR=http://0.0.0.0:8200`
- `VAULT_TOKEN` configuré avec le token root

Exemples dans le shell :
```bash
# Lister les secrets KV v2
vault kv list secret/data/

# Récupérer le PASSWORD_SECRET_KEY
vault kv get secret/data/sesame

# Vérifier l'état de Vault
vault status
```

> ⚠️ **Sécurité** :
> - Le token root **n'est jamais affiché** dans le terminal par les commandes Makefile
> - L'accès via `make vault-shell` nécessite un **accès Docker** sur la machine
> - Le backend utilise **AppRole** (pas le token root) pour accéder aux secrets
> - En production : désactivez le token root et utilisez uniquement AppRole

### Configuration pour la production

En production, configurez Vault avec :
- **AppRole uniquement** (pas de token root)
- **Montage du volume** pour les fichiers Role ID/Secret ID
- **Réseau sécurisé** (HTTPS, pas d'exposition publique de Vault)

Exemple de configuration backend (.env) :
```
VAULT_ADDR=https://vault.prod.internal:8200
VAULT_ROLE_ID_FILE=/run/secrets/vault_role_id
VAULT_SECRET_ID_FILE=/run/secrets/vault_secret_id
```

### Intégration continue (CI)

Pour les tests CI sans Vault :
- Utilisez `backend/src/tests/password.test.ts` qui contourne Vault
- Ou configurez un Vault éphémère dans votre pipeline

## Tests

```bash
cd backend && npm test
```

Vérifie le déterminisme du mot de passe, le respect des critères,
l'unicité par SN / code client, la compatibilité des versions et le
connecteur CRM.

## Notes

- La persistance utilise un stockage JSON simple (`backend/data/db.json`),
  isolé derrière le module `db.ts` : il peut être remplacé par SQLite ou
  PostgreSQL sans toucher au reste du code.
- Les mots de passe ne sont pas stockés en base : ils sont toujours
  recalculés à partir du SN, du code client et de la version courante.
- Les fichiers `backend/.env` et `frontend/.env` ne sont pas versionnés
  (seuls `.env.example` le sont) et aucun secret n'entre dans les images
  Docker.
- En Docker, le frontend conteneurisé appelle l'API en même origine via le
  proxy nginx ; en développement, c'est le proxy Vite qui joue ce rôle.
- **Vault** : en développement, un conteneur Vault est démarré automatiquement
  avec AppRole. En production, configurez votre propre instance Vault avec
  la politique `sesame-backend` (voir section HashiCorp Vault).
