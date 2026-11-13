# Sésame — Gestion sécurisée de mots de passe clients
#
# Usage : make <cible>
# Orchestration Docker de l'application (backend + frontend).
# Les commandes npm de développement et de test restent utilisables
# directement dans backend/ et frontend/ (voir README).

FRONTEND_PORT = 5173
BACKEND_PORT = 4000
COMPOSE = docker compose

.DEFAULT_GOAL := help

.PHONY: help docker docker-build docker-up docker-down docker-logs \
        docker-restart docker-clean kill-port

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

docker: docker-build docker-up ## Construit les images puis démarre les conteneurs

docker-build: ## Construit les images Docker (backend + frontend)
	$(COMPOSE) build

docker-up: ## Démarre les conteneurs en arrière-plan (UI :5173, API :4000)
	$(COMPOSE) up -d
	@echo "Interface : http://localhost:$(FRONTEND_PORT) — API : http://localhost:$(BACKEND_PORT)"

docker-down: ## Arrête et supprime les conteneurs
	$(COMPOSE) down

docker-logs: ## Suit les logs des conteneurs (Ctrl-C pour sortir)
	$(COMPOSE) logs -f

docker-restart: docker-down docker-up ## Redémarre l'application conteneurisée

docker-clean: ## Arrête les conteneurs et supprime les images locales
	$(COMPOSE) down --rmi local

kill-port: ## Libère un port occupé : make kill-port PORT=<numéro>
	@if [ -z "$(PORT)" ]; then \
		echo "Usage : make kill-port PORT=<numéro> (ex. 4000 ou 5173)"; \
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
