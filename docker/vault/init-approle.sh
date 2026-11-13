#!/bin/sh
# Script d'initialisation Vault avec AppRole pour le développement

set -e

echo "⏳ Attente que Vault soit prêt..."

# Exporter les variables pour vault CLI
VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_ADDR

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
path "secret/data/sesame" {
  capabilities = ["read"]
}
path "secret/sesame" {
  capabilities = ["read"]
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

# Stocker le PASSWORD_SECRET_KEY dans Vault
PASSWORD_SECRET="2f7e4c8a0b1d3e5c9b2a4d6e8f0c1a3b5d7e9f2c4a6b8d0e1f3c5a7b9d2e4f6"
echo "📦 Stockage du secret dans Vault..."
vault kv put secret/data/sesame password_secret_key="$PASSWORD_SECRET"

# Stocker aussi en KV v1 pour compatibilité
vault kv put secret/sesame password_secret_key="$PASSWORD_SECRET"

echo "✅ Vault initialisé avec AppRole!"
echo "   Role ID: $ROLE_ID"
echo "   Secret ID: $SECRET_ID"
echo "   PASSWORD_SECRET_KEY stocké dans Vault"

# Garder le conteneur en vie
sleep infinity
