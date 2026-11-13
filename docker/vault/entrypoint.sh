#!/bin/sh
# Entrypoint pour Vault avec initialisation AppRole
# Source : common.sh pour les fonctions partagées

# Charger la configuration commune
source /docker-entrypoint-init.d/common.sh

# Générer un token root aléatoire (32 caractères alphanumériques)
VAULT_ROOT_TOKEN=$(generate_root_token 32)
export VAULT_TOKEN="$VAULT_ROOT_TOKEN"

# Stocker le token root dans un fichier pour les autres conteneurs
mkdir -p /vault/secrets
echo "$VAULT_ROOT_TOKEN" > /vault/secrets/vault_root_token

# Démarrer Vault en arrière-plan avec le token généré
/bin/vault server -dev \
  -dev-listen-address=0.0.0.0:${VAULT_PORT} \
  -dev-root-token-id="$VAULT_ROOT_TOKEN" &
VAULT_PID=$!

# Attendre que Vault soit prêt (utilise la fonction commune)
wait_for_vault || exit 1

# Exécuter le script d'initialisation AppRole si présent
if [ -f /docker-entrypoint-init.d/init-approle.sh ]; then
  echo "🔧 Initialisation AppRole..."
  /docker-entrypoint-init.d/init-approle.sh
fi

# Garder le conteneur en vie
wait
