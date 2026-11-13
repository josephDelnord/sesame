#!/bin/sh
# Script d'initialisation Vault avec AppRole pour le développement

set -e

echo "⏳ Attente que Vault soit prêt..."

# Exporter les variables pour vault CLI
VAULT_ADDR="http://0.0.0.0:8200"
export VAULT_ADDR

# Lire le token root depuis le fichier
if [ -f /vault/secrets/vault_root_token ]; then
  VAULT_TOKEN=$(cat /vault/secrets/vault_root_token)
  export VAULT_TOKEN
fi

# Attendre que Vault réponde
TRY=0
MAX_TRY=30
while ! vault status > /dev/null 2>&1; do
  TRY=$((TRY + 1))
  if [ $TRY -ge $MAX_TRY ]; then
    echo "❌ Vault n'a pas démarré après $MAX_TRY secondes"
    exit 1
  fi
  sleep 1
done

echo "✅ Vault est démarré"

# Activer AppRole
if ! vault auth list | grep -q approle; then
  echo "🔧 Activation de AppRole..."
  vault auth enable approle
fi

# Créer une politique pour le backend
if ! vault policy list | grep -q sesame-backend; then
  echo "📜 Création de la politique sesame-backend..."
  vault policy write sesame-backend - <<EOF
# KV v2 - Accès en lecture complète
path "secret/data/sesame" {
  capabilities = ["read", "list"]
}
path "secret/metadata/sesame" {
  capabilities = ["read", "list"]
}
# KV v2 - Accès au backend KV
path "secret/metadata/*" {
  capabilities = ["list"]
}
path "secret/data/*" {
  capabilities = ["read", "list"]
}
# KV v1 - Accès en lecture
path "secret/sesame" {
  capabilities = ["read", "list"]
}
EOF
fi

# Créer un rôle AppRole
if ! vault list auth/approle/role | grep -q sesame-backend; then
  echo "🎭 Création du rôle AppRole sesame-backend..."
  vault write auth/approle/role/sesame-backend \
    policies=sesame-backend \
    token_ttl=24h \
    token_max_ttl=48h
fi

# Récupérer Role ID et Secret ID
ROLE_ID=$(vault read -field=role_id auth/approle/role/sesame-backend/role-id)
SECRET_ID=$(vault write -f -field=secret_id auth/approle/role/sesame-backend/secret-id)

# Stocker Role ID et Secret ID dans des fichiers
mkdir -p /vault/secrets
echo "$ROLE_ID" > /vault/secrets/vault_role_id
echo "$SECRET_ID" > /vault/secrets/vault_secret_id

# Générer et stocker le PASSWORD_SECRET_KEY dans Vault (64 bytes hex = 128 caractères)
echo "📦 Génération et stockage du secret dans Vault..."
PASSWORD_SECRET=$(vault write -format=json sys/tools/random bytes=64 format=hex 2>/dev/null | sed -n 's/.*"random_bytes": "\([^"]*\).*/\1/p')
vault kv put secret/data/sesame password_secret_key="$PASSWORD_SECRET"

# Stocker aussi en KV v1 pour compatibilité
vault kv put secret/sesame password_secret_key="$PASSWORD_SECRET"

echo "✅ Vault initialisé avec AppRole!"
echo "   Role ID: $ROLE_ID"
echo "   Secret ID: $SECRET_ID"
echo "   PASSWORD_SECRET_KEY généré et stocké dans Vault"

# Garder le conteneur en vie
sleep infinity
