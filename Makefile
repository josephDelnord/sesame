# Sésame — Gestion sécurisée de mots de passe clients
#
# Usage : make <cible>
# Orchestration Docker de l'application (backend + frontend + Vault).
#
# PROFILS DOCKER COMPOSE :
#   - dev : Vault local (docker compose --profile dev up)
#   - test : Vault + backend pour les tests
#   - backend : API backend
#   - frontend : Interface utilisateur
#
# Les commandes npm de développement et de test restent utilisables
# directement dans backend/ et frontend/ (voir README).

# --- Configuration centralisée ---
FRONTEND_PORT ?= 3000
BACKEND_PORT ?= 4000
VAULT_PORT ?= 8200
VAULT_ADDR_LOCAL ?= http://0.0.0.0:$(VAULT_PORT)
VAULT_ADDR ?= http://vault:$(VAULT_PORT)
VAULT_CONTAINER ?= sesame-vault-1
COMPOSE = docker compose
# Séparés par des virgules pour Docker Compose
DOCKER_PROFILES ?= dev,backend,frontend

# --- Fonction réutilisable pour exécuter des commandes dans Vault ---
define VAULT_EXEC
@docker exec $(VAULT_CONTAINER) sh -c 'export VAULT_ADDR=$(VAULT_ADDR_LOCAL); \
  export VAULT_TOKEN=$$(cat /vault/secrets/vault_root_token); $(1)'
endef

# --- Fonction réutilisable pour attendre que Vault soit prêt ---
define WAIT_FOR_VAULT
@echo "⏳ Attente que Vault soit complètement initialisé..."; \
while ! docker exec $(VAULT_CONTAINER) test -f /vault/secrets/initialized 2>/dev/null; do sleep 1; done
endef

.DEFAULT_GOAL := help

.PHONY: help docker docker-build docker-up docker-down docker-logs \
        docker-restart docker-clean kill-port \
        vault-up vault-init vault-down vault-shell wait-for-vault \
        dev-up prod-up full-up \
        test-integration test-backend test-all docker-test-up docker-test-down

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# --- Démarrage standard ---

docker: docker-build docker-up ## Construit les images puis démarre les conteneurs

docker-build: ## Construit les images Docker (backend + frontend)
	$(COMPOSE) build

docker-up: ## Démarre les conteneurs en arrière-plan (selon DOCKER_PROFILES)
	$(COMPOSE) --profile $(DOCKER_PROFILES) up -d
	@echo "Services démarrés avec les profils : $(subst $(comma),$(space),$(DOCKER_PROFILES))"
	@if echo " $(DOCKER_PROFILES) " | grep -q " frontend "; then \
		echo "Interface : http://localhost:$(FRONTEND_PORT)"; \
	fi
	@if echo " $(DOCKER_PROFILES) " | grep -q " backend "; then \
		echo "API : http://localhost:$(BACKEND_PORT)"; \
	fi
	@if echo " $(DOCKER_PROFILES) " | grep -q " dev "; then \
		echo "Vault : http://localhost:$(VAULT_PORT)"; \
	fi

docker-down: ## Arrête et supprime les conteneurs (tous les profils)
	@echo "Arrêt des conteneurs..."
	$(COMPOSE) --profile dev --profile test --profile backend --profile frontend down --remove-orphans

docker-logs: ## Suit les logs des conteneurs (Ctrl-C pour sortir)
	$(COMPOSE) --profile dev --profile test --profile backend --profile frontend logs -f

docker-restart: docker-down docker-up ## Redémarre l'application conteneurisée

docker-clean: ## Arrête les conteneurs et supprime les images locales
	@echo "Nettoyage des conteneurs et images..."
	$(COMPOSE) --profile dev --profile test --profile backend --profile frontend down --rmi local --remove-orphans

kill-port: ## Libère un port occupé : make kill-port PORT=<numéro>
	@if [ -z "$(PORT)" ]; then \
		echo "Usage : make kill-port PORT=<numéro> (ex. 4000 ou 3000)"; \
		exit 2; \
	fi
	@if ! ss -ltn 2>/dev/null | grep -qE "[:.]$(PORT)[[:space:]]"; then \
		echo "Le port $(PORT) est libre."; \
		exit 0; \
	fi
	@pids=$$(ss -ltnp 2>/dev/null | grep -E "[:.]$(PORT)[[:space:]]" \
		| grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u); \
	if [ -z "$$pids" ]; then \
		echo "Le port $(PORT) est occupé par un processus d'un autre utilisateur (souvent docker-proxy)."; \
		echo "Si Docker tourne : make docker-down — sinon : sudo lsof -t -i :$(PORT) | xargs sudo kill"; \
		exit 1; \
	fi; \
	if ps -p $$pids -o cmd= | grep -q docker-proxy; then \
		echo "Le port $(PORT) est publié par Docker (docker-proxy)."; \
		echo "Utilisez plutôt : make docker-down"; \
		exit 1; \
	fi; \
	echo "Port $(PORT) occupé par :"; \
	ps -o pid= -o cmd= -p $$pids; \
	kill $$pids && sleep 1; \
	if ss -ltn 2>/dev/null | grep -qE "[:.]$(PORT)[[:space:]]"; then \
		echo "Toujours actif, forçage (SIGKILL)…"; \
		kill -9 $$pids 2>/dev/null || true; \
	fi; \
	echo "Port $(PORT) libéré."

wait-for-vault: ## Attend que Vault soit complètement initialisé
	$(call WAIT_FOR_VAULT)

# --- Vault ---

vault-up: ## Démarre Vault pour le développement (avec AppRole auto-configuré)
	$(COMPOSE) --profile dev up -d vault
	@echo "Vault démarré : $(VAULT_ADDR_LOCAL)"
	@echo "⏳ Attente que Vault soit prêt..."
	@while ! $(COMPOSE) --profile dev ps vault | grep -q healthy; do sleep 1; done
	@echo "✅ Vault et AppRole initialisés"

vault-init: vault-up wait-for-vault ## Démarre Vault et stocke les secrets

vault-down: ## Arrête Vault
	@echo "Arrêt de Vault..."
	$(COMPOSE) --profile dev,test stop vault
	$(COMPOSE) --profile dev,test rm -fsv vault

vault-shell: ## Ouvre un shell admin dans le conteneur Vault (nécessite accès Docker)
	@echo "⚠️  Accès admin - nécessite les droits Docker"
	@if [ -t 1 ]; then \
		docker exec -it $(VAULT_CONTAINER) sh -c 'export VAULT_ADDR=$(VAULT_ADDR_LOCAL); export VAULT_TOKEN=$$(cat /vault/secrets/vault_root_token); sh'; \
	else \
		docker exec -i $(VAULT_CONTAINER) sh -c 'export VAULT_ADDR=$(VAULT_ADDR_LOCAL); export VAULT_TOKEN=$$(cat /vault/secrets/vault_root_token); sh'; \
	fi

# --- Convenience targets pour dev/prod ---

dev-up: ## Démarre tous les services en mode développement (Vault + backend + frontend)
	@echo "🚀 Démarrage en mode DEVELOPPEMENT (avec Vault local)..."
	@$(COMPOSE) --profile dev --profile backend --profile frontend up -d
	$(call WAIT_FOR_VAULT)
	@echo "✅ Tous les services démarrés :"
	@echo "   Vault : http://localhost:$(VAULT_PORT)"
	@echo "   API : http://localhost:$(BACKEND_PORT)"
	@echo "   Interface : http://localhost:$(FRONTEND_PORT)"

prod-up: ## Démarre backend + frontend pour production (Vault externe requis)
	@echo "🚀 Démarrage en mode PRODUCTION (Vault externe requis)..."
	@echo "   Assurez-vous que VAULT_ADDR pointe vers votre Vault externe."
	@$(COMPOSE) --profile backend --profile frontend up -d
	@echo "✅ Services production démarrés :"
	@echo "   API : http://localhost:$(BACKEND_PORT)"
	@echo "   Interface : http://localhost:$(FRONTEND_PORT)"

# full-up : démarre Vault + backend + frontend (tout-en-un)
full-up: vault-init dev-up ## Démarre Vault + stocke les secrets + backend + frontend

# --- Tests ---

docker-test-up: ## Démarre Vault + backend pour les tests d'intégration
	@echo "🧪 Démarrage des services pour les tests d'intégration..."
	@$(COMPOSE) --profile test,backend up -d vault
	@echo "⏳ Attente que Vault soit prêt..."
	@while ! $(COMPOSE) --profile test ps vault | grep -q healthy; do sleep 1; done
	@echo "✅ Services prêts pour les tests"

docker-test-down: ## Arrête les services de test
	@echo "Arrêt des services de test..."
	$(COMPOSE) --profile test --profile backend down --remove-orphans

test-integration: docker-test-up ## Exécute les tests d'intégration avec Vault
	@echo "🧪 Exécution des tests d'intégration..."
	@cd backend && docker exec -it sesame-test npm run test:integration

test-backend: ## Exécute les tests unitaires du backend
	@echo "🧪 Exécution des tests unitaires..."
	cd backend && npm test

test-all: test-backend test-integration ## Exécute tous les tests (unitaires + intégration)
