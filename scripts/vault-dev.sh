#!/bin/bash
# Script pour démarrer Vault en mode dev et stocker le secret

set -e

echo "🚀 Démarrage de Vault en mode développement..."

# Démarrer Vault
make vault-up

# Attendre que Vault soit healthy
echo "⏳ Attente que Vault soit prêt..."
for i in {1..30}; do
  if docker inspect --format='{{json .State.Health.Status}}' sesame-vault-1 2>/dev/null | grep -q healthy; then
    echo "✅ Vault est prêt"
    break
  fi
  sleep 1
  echo "   Attente... ($i/30)"
done

# Stocker le secret dans Vault (KV v1 pour simplifier)
echo "📦 Stockage du PASSWORD_SECRET_KEY dans Vault..."
docker exec sesame-vault-1 sh -c "\
  export VAULT_ADDR=http://127.0.0.1:8200; \
  export VAULT_TOKEN=root; \
  /bin/vault kv put secret/sesame password_secret_key=2f7e4c8a0b1d3e5c9b2a4d6e8f0c1a3b5d7e9f2c4a6b8d0e1f3c5a7b9d2e4f6
"

echo "✅ Vault initialisé avec le secret!"
echo "   URL: http://localhost:8200"
echo "   Token: root"
echo ""
echo "💡 Pour démarrer le backend : make docker-up"
