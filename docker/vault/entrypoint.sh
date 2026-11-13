#!/bin/sh
# Entrypoint pour Vault avec initialisation AppRole

# Exporter VAULT_ADDR pour les commandes vault
export VAULT_ADDR="http://0.0.0.0:8200"

# Démarrer Vault en arrière-plan avec l'adresse correcte
vault server -dev -dev-listen-address=0.0.0.0:8200 -dev-root-token-id=root &
VAULT_PID=$!

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
