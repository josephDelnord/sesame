#!/bin/sh
# Entrypoint pour Vault avec initialisation AppRole

# Démarrer Vault en arrière-plan
vault server -dev &
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
  /docker-entrypoint-init.d/init-approle.sh &
fi

# Attendre la fin du script d'init
wait
