#!/bin/sh
# Script d'initialisation Vault avec AppRole pour le développement
# Source : common.sh pour les fonctions partagées

set -e

# Charger la configuration commune
source /docker-entrypoint-init.d/common.sh

# Attendre que Vault réponde (utilise la fonction commune)
wait_for_vault || exit 1

# Activer AppRole
if ! vault auth list | grep -q approle; then
  echo "🔧 Activation de AppRole..."
  vault auth enable approle
fi

# Créer une politique pour le backend
if ! vault policy list | grep -q sesame-backend; then
  echo "📜 Création de la politique sesame-backend..."
  vault policy write sesame-backend - <<EOF
# KV v2 - Accès en lecture complète au secret
path "secret/data/data/sesame" {
  capabilities = ["read", "list"]
}
path "secret/metadata/sesame" {
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
mkdir -p /vault/secrets
vault read -field=role_id auth/approle/role/sesame-backend/role-id > /vault/secrets/vault_role_id
vault write -f -field=secret_id auth/approle/role/sesame-backend/secret-id > /vault/secrets/vault_secret_id

# Générer et stocker les secrets dans Vault (KV v2)
echo "📦 Génération et stockage des secrets dans Vault..."

# Générer les deux secrets
PASSWORD_SECRET=$(generate_hex_secret 64)
ADMIN_TOKEN=$(generate_hex_secret 32)

# Stocker les deux clés en une seule commande pour éviter d'écraser
/bin/vault kv put secret/data/sesame \
  password_secret_key="$PASSWORD_SECRET" \
  admin_token="$ADMIN_TOKEN"

echo "✅ Vault initialisé avec AppRole!"
echo "   Role ID: $(cat /vault/secrets/vault_role_id)"
echo "   Secret ID: $(cat /vault/secrets/vault_secret_id)"
echo "   PASSWORD_SECRET_KEY généré et stocké dans Vault"
echo "   ADMIN_TOKEN généré et stocké dans Vault"

# Créer un fichier de verrouillage pour indiquer que l'initialisation est terminée
touch /vault/secrets/initialized

# Garder le conteneur en vie
sleep infinity
