# Gestion des secrets avec HashiCorp Vault

Ce document explique comment Sésame utilise HashiCorp Vault pour stocker et gérer les secrets de manière sécurisée.

## Architecture

Sésame utilise **HashiCorp Vault** en mode KV v2 pour stocker les secrets nécessaires à son fonctionnement :

- **`PASSWORD_SECRET_KEY`** : Sel statique utilisé pour la génération déterministe des mots de passe
- **`ADMIN_TOKEN`** : Token d'administration requis pour la régénération des mots de passe

### Chemin de stockage

Tous les secrets sont stockés dans Vault à l'emplacement **KV v2** :
```
secret/data/sesame
```

Ce qui correspond au chemin physique :
```
secret/data/data/sesame
```

### Structure des données

```json
{
  "data": {
    "password_secret_key": "<64 bytes hex>",
    "admin_token": "<32 bytes hex>"
  }
}
```

## Configuration

### Environnement de développement

En développement, Vault est automatiquement démarré et configuré via Docker Compose avec :

1. **Un conteneur Vault** en mode dev
2. **Un token root** généré aléatoirement (32 caractères)
3. **Un rôle AppRole** (`sesame-backend`) pour l'authentification du backend
4. **Une politique** autorisant la lecture des secrets à `secret/data/data/sesame`

#### Variables d'environnement (fichier `.env` à la racine)

```ini
# Ports
FRONTEND_PORT=3000
BACKEND_PORT=4000
VAULT_PORT=8200

# Vault pour les conteneurs (nom du service dans le réseau Docker)
VAULT_ADDR=http://vault:8200
```

### Environnement de production

En production, configurez les variables suivantes pour le backend :

#### Via Docker Compose

```yaml
services:
  backend:
    environment:
      VAULT_ADDR: https://vault.prod.internal:8200
      VAULT_ROLE_ID_FILE: /run/secrets/vault_role_id
      VAULT_SECRET_ID_FILE: /run/secrets/vault_secret_id
    volumes:
      - vault_secrets:/run/secrets:ro
```

#### Via fichiers (backend/.env)

```ini
# Vault
VAULT_ADDR=https://vault.prod.internal:8200
# Les fichiers Role ID et Secret ID doivent être montés via volumes
```

## Authentification

### AppRole (recommandé)

Le backend utilise **AppRole** pour s'authentifier auprès de Vault :

- **Role ID** : Stocké dans `/vault/secrets/vault_role_id` (monté via volume)
- **Secret ID** : Stocké dans `/vault/secrets/vault_secret_id` (monté via volume)

#### Configuration AppRole

1. **Créer une politique** :
   ```bash
   vault policy write sesame-backend - <<EOF
   path "secret/data/data/sesame" {
     capabilities = ["read", "list"]
   }
   path "secret/metadata/sesame" {
     capabilities = ["read", "list"]
   }
   EOF
   ```

2. **Créer un rôle** :
   ```bash
   vault write auth/approle/role/sesame-backend \
     policies=sesame-backend \
     token_ttl=24h \
     token_max_ttl=48h
   ```

3. **Récupérer les identifiants** :
   ```bash
   # Role ID
   vault read -field=role_id auth/approle/role/sesame-backend/role-id
   
   # Secret ID (à générer une fois)
   vault write -f -field=secret_id auth/approle/role/sesame-backend/secret-id
   ```

### Token direct (développement/test)

Pour les tests ou le développement, vous pouvez utiliser directement le token root :

```bash
vault token create -policy=sesame-backend
```

## Commandes Makefile

### Développement

| Commande | Description |
|----------|-------------|
| `make full-up` | Démarre Vault + backend + frontend (tout en une commande) |
| `make vault-up` | Démarre uniquement Vault |
| `make vault-init` | Démarre Vault et stocke les secrets |
| `make vault-down` | Arrête Vault |
| `make vault-shell` | Ouvre un shell admin dans Vault |
| `make dev-up` | Démarre tous les services (Vault + backend + frontend) |

### Production

| Commande | Description |
|----------|-------------|
| `make prod-up` | Démarre backend + frontend (Vault externe requis) |
| `make docker-down` | Arrête tous les conteneurs |

### Tests

| Commande | Description |
|----------|-------------|
| `make test-backend` | Exécute les tests unitaires |
| `make test-integration` | Exécute les tests d'intégration avec Vault |
| `make test-all` | Exécute tous les tests |

## Accès aux secrets

### Depuis le conteneur Vault

```bash
# Connexion avec le token root
docker exec -it sesame-vault-1 sh
VAULT_TOKEN=$(cat /vault/secrets/vault_root_token)
vault kv get secret/data/sesame

# Résultat attendu :
# ===== Secret Path =====
# secret/data/data/sesame
# 
# ======= Data ===========
# Key                    Value
# ---                    -----
# admin_token            <votre_admin_token>
# password_secret_key    <votre_password_secret_key>
```

### Depuis la machine hôte

```bash
# Récupérer PASSWORD_SECRET_KEY
docker exec sesame-vault-1 sh -c 'export VAULT_ADDR=http://0.0.0.0:8200; export VAULT_TOKEN=$(cat /vault/secrets/vault_root_token); vault kv get -field=password_secret_key secret/data/sesame'

# Récupérer ADMIN_TOKEN
docker exec sesame-vault-1 sh -c 'export VAULT_ADDR=http://0.0.0.0:8200; export VAULT_TOKEN=$(cat /vault/secrets/vault_root_token); vault kv get -field=admin_token secret/data/sesame'
```

### Depuis le backend (via API)

Le backend récupère automatiquement les secrets depuis Vault au démarrage.

## Rotation des secrets

### Régénérer PASSWORD_SECRET_KEY

```bash
# Générer un nouveau secret (64 bytes hex)
NEW_SECRET=$(vault write -format=json sys/tools/random bytes=64 format=hex | jq -r '.data.random_bytes')

# Mettre à jour dans Vault
vault kv put secret/data/sesame password_secret_key="$NEW_SECRET"

# Redémarrer le backend pour qu'il utilise le nouveau secret
make docker-restart
```

### Régénérer ADMIN_TOKEN

```bash
# Générer un nouveau token (32 bytes hex)
NEW_TOKEN=$(vault write -format=json sys/tools/random bytes=32 format=hex | jq -r '.data.random_bytes')

# Mettre à jour dans Vault
vault kv put secret/data/sesame admin_token="$NEW_TOKEN"

# Note : Le backend cache l'ADMIN_TOKEN. Pour forcer le rechargement :
# - Redémarrer le backend, ou
# - Attendre que le cache expire (si implémenté)
```

## Dépannage

### "Vault est OBLIGATOIRE"

**Cause** : Le backend ne parvient pas à se connecter à Vault.

**Solutions** :
1. Vérifiez que Vault est démarré : `docker ps | grep vault`
2. Vérifiez que le healthcheck passe : `docker inspect --format='{{.State.Health.Status}}' sesame-vault-1`
3. Vérifiez que `VAULT_ADDR` est correct :
   - Dans les conteneurs : `http://vault:8200`
   - Depuis la machine hôte : `http://localhost:8200` ou `http://0.0.0.0:8200`
4. Vérifiez que les fichiers Role ID et Secret ID existent :
   ```bash
   docker exec sesame-vault-1 ls -la /vault/secrets/
   ```

### "Secret introuvable dans Vault"

**Cause** : Les secrets n'ont pas été stockés dans Vault.

**Solution** :
```bash
# Vérifiez que les secrets existent
vault kv get secret/data/sesame

# Si non, régénérez-les
make vault-init
```

### "Permission denied"

**Cause** : La politique AppRole n'est pas correctement configurée.

**Solution** :
```bash
# Vérifiez la politique
vault policy read sesame-backend

# Vérifiez que le rôle est correct
vault read auth/approle/role/sesame-backend
```

## Sécurité

### Bonnes pratiques

1. **Ne jamais committer de secrets** : Tous les fichiers `.env` sont dans `.gitignore`
2. **Utiliser AppRole** : Préférez AppRole au token root pour l'authentification
3. **Limiter les permissions** : La politique doit autoriser uniquement la lecture des secrets nécessaires
4. **Désactiver le token root** : En production, désactivez le token root après l'initialisation
5. **Rotater les secrets** : Régénérez périodiquement PASSWORD_SECRET_KEY et ADMIN_TOKEN

### En production

1. **Ne pas exposer Vault publiquement** : Vault doit être accessible uniquement depuis votre réseau interne
2. **Utiliser HTTPS** : Configurez Vault avec un certificat TLS valide
3. **Chiffrer les volumes** : Les volumes Docker contenant les secrets doivent être chiffrés
4. **Audit** : Activez l'audit de Vault pour suivre les accès aux secrets

## Références

- [Documentation HashiCorp Vault](https://www.vaultproject.io/docs)
- [Authentification AppRole](https://www.vaultproject.io/docs/auth/approle)
- [Moteur KV v2](https://www.vaultproject.io/docs/secrets/kv/kv-v2)
