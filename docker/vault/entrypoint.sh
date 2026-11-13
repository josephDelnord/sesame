#!/bin/sh
# Entrypoint pour Vault avec initialisation AppRole

# Générer un token root aléatoire (32 caractères alphanumériques)
VAULT_ROOT_TOKEN=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c32)
export VAULT_ROOT_TOKEN

# Exporter VAULT_ADDR pour les commandes vault
export VAULT_ADDR="http://0.0.0.0:8200"

# Stocker le token root dans un fichier pour les autres conteneurs
mkdir -p /vault/secrets
echo "$VAULT_ROOT_TOKEN" > /vault/secrets/vault_root_token

# Démarrer Vault en arrière-plan avec le token généré
vault server -dev -dev-listen-address=0.0.0.0:8200 -dev-root-token-id="$VAULT_ROOT_TOKEN" &
VAULT_PID=$!

# Attendre que Vault soit prêt et exporter le token pour les processus enfants
export VAULT_TOKEN="$VAULT_ROOT_TOKEN"

# Attendre que Vault soit prêt
echo "⏳ Attente que Vault soit prêt..."
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

# Exécuter le script d'initialisation AppRole
if [ -f /docker-entrypoint-init.d/init-approle.sh ]; then
  echo "🔧 Initialisation AppRole..."
  /docker-entrypoint-init.d/init-approle.sh
fi

# Garder le conteneur en vie
wait
