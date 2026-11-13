# Gestion des secrets avec HashiCorp Vault

## Accès rapide aux secrets

### Depuis la machine hôte
```bash
# Récupérer PASSWORD_SECRET_KEY
docker exec sesame-vault-1 sh -c 'export VAULT_ADDR=http://0.0.0.0:8200; export VAULT_TOKEN=$(cat /vault/secrets/vault_root_token); vault kv get -field=password_secret_key secret/data/sesame'

# Récupérer ADMIN_TOKEN
docker exec sesame-vault-1 sh -c 'export VAULT_ADDR=http://0.0.0.0:8200; export VAULT_TOKEN=$(cat /vault/secrets/vault_root_token); vault kv get -field=admin_token secret/data/sesame'

# Afficher tous les secrets
vault kv get secret/data/sesame
```

### Depuis le conteneur Vault
```bash
docker exec -it sesame-vault-1 sh
VAULT_TOKEN=$(cat /vault/secrets/vault_root_token)
vault kv get secret/data/sesame
```

---

## Architecture

**Chemin de stockage** (KV v2) : `secret/data/sesame`

**Secrets stockés** :
- `password_secret_key` (64 bytes hex) : sel pour la génération des mots de passe
- `admin_token` (32 bytes hex) : token pour la régénération admin

---

## Configuration

### Développement (Docker Compose)

Fichier `.env` à la racine :
```ini
FRONTEND_PORT=3000
BACKEND_PORT=4000
VAULT_PORT=8200
VAULT_ADDR=http://vault:8200
```

Commandes :
```bash
make full-up      # Démarre tout (Vault + backend + frontend)
make dev-up       # Démarre tous les services
make vault-up     # Démarre uniquement Vault
make vault-shell  # Shell admin dans Vault
```

### Production

Variables backend :
```ini
VAULT_ADDR=https://vault.prod.internal:8200
```

Montage des volumes pour AppRole :
```yaml
volumes:
  - vault_secrets:/run/secrets:ro
```

---

## Authentification

### AppRole (recommandé)

Fichiers montés depuis le conteneur Vault :
- `/vault/secrets/vault_role_id`
- `/vault/secrets/vault_secret_id`

Politique requise :
```hcl
path "secret/data/data/sesame" {
  capabilities = ["read", "list"]
}
```

---

## Rotation des secrets

### Régénérer PASSWORD_SECRET_KEY
```bash
NEW_SECRET=$(vault write -format=json sys/tools/random bytes=64 format=hex | jq -r '.data.random_bytes')
vault kv put secret/data/sesame password_secret_key="$NEW_SECRET"
make docker-restart
```

### Régénérer ADMIN_TOKEN
```bash
NEW_TOKEN=$(vault write -format=json sys/tools/random bytes=32 format=hex | jq -r '.data.random_bytes')
vault kv put secret/data/sesame admin_token="$NEW_TOKEN"
```

---

## Dépannage

| Erreur | Solution |
|--------|----------|
| Vault est OBLIGATOIRE | Vérifiez `docker ps \| grep vault` et le healthcheck |
| Secret introuvable | `make vault-init` pour régénérer les secrets |
| Permission denied | Vérifiez la politique AppRole |

---

## Sécurité

- ✅ Ne jamais committer de secrets (tous les `.env` sont dans `.gitignore`)
- ✅ Utiliser AppRole plutôt que le token root
- ✅ Limiter les permissions de la politique
- ✅ Désactiver le token root en production
- ✅ Rotater les secrets périodiquement
- ✅ Ne pas exposer Vault publiquement
- ✅ Utiliser HTTPS en production
