#!/bin/sh
# Configuration et fonctions communes pour les scripts Vault
# Sourcez ce fichier avec : source /docker-entrypoint-init.d/common.sh

# --- Configuration par défaut ---
export PATH="/usr/bin:$PATH"
export VAULT_ADDR="${VAULT_ADDR:-http://0.0.0.0:8200}"
export VAULT_PORT="${VAULT_PORT:-8200}"

# Charge le token root depuis le fichier si VAULT_TOKEN n'est pas déjà défini
if [ -z "$VAULT_TOKEN" ] && [ -f /vault/secrets/vault_root_token ]; then
  export VAULT_TOKEN="$(cat /vault/secrets/vault_root_token)"
fi

# --- Fonctions réutilisables ---

# Attend que Vault soit prêt
# Usage: wait_for_vault [max_retries]
wait_for_vault() {
  local MAX_TRY="${1:-30}"
  local TRY=0
  
  echo "⏳ Attente que Vault soit prêt..."
  while ! /bin/vault status > /dev/null 2>&1; do
    TRY=$((TRY + 1))
    if [ $TRY -ge $MAX_TRY ]; then
      echo "❌ Vault n'a pas démarré après $MAX_TRY secondes"
      return 1
    fi
    sleep 1
  done
  
  echo "✅ Vault est prêt"
  return 0
}

# Génère un token root aléatoire
# Usage: generate_root_token [length]
generate_root_token() {
  local LENGTH="${1:-32}"
  head /dev/urandom | tr -dc A-Za-z0-9 | head -c"$LENGTH"
}

# Génère un secret hex aléatoire
# Usage: generate_hex_secret [bytes]
generate_hex_secret() {
  local BYTES="${1:-64}"
  /bin/vault write -format=json sys/tools/random bytes="$BYTES" format=hex 2>/dev/null | \
    sed -n 's/.*"random_bytes": "\([^"]*\)".*/\1/p'
}

# Stocke un secret dans Vault KV v2
# Usage: vault_put_secret path key value
vault_put_secret() {
  local SECRET_PATH="$1"
  local KEY="$2"
  local VALUE="$3"
  /bin/vault kv put "$SECRET_PATH" "$KEY"="$VALUE"
}
