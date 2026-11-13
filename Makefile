# Sésame — Gestion sécurisée de mots de passe clients
#
# Usage : make <cible>
# Cibles courantes : install, build, test, dev, clean

BACKEND_DIR = backend
FRONTEND_DIR = frontend
BACKEND_PORT = 4000
FRONTEND_PORT = 5173

.DEFAULT_GOAL := help

.PHONY: help install install-backend install-frontend build build-backend \
        build-frontend test test-backend start serve dev dev-backend \
        dev-frontend seed clean clean-db

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: install-backend install-frontend ## Installe toutes les dépendances

install-backend: ## Installe les dépendances du backend
	npm --prefix $(BACKEND_DIR) install

install-frontend: ## Installe les dépendances du frontend
	npm --prefix $(FRONTEND_DIR) install

build: build-backend build-frontend ## Compile le backend et le frontend

build-backend: ## Compile le backend (TypeScript -> dist/)
	npm --prefix $(BACKEND_DIR) run build

build-frontend: ## Compile le frontend (Vite -> dist/)
	npm --prefix $(FRONTEND_DIR) run build

test: test-backend ## Lance les tests automatisés

test-backend: ## Lance les tests de la formule de mot de passe
	npm --prefix $(BACKEND_DIR) test

start: ## Démarre le backend en production (build au préalable)
	npm --prefix $(BACKEND_DIR) run start

serve: build ## Build puis démarre le backend en production
	npm --prefix $(BACKEND_DIR) run start

dev: ## Démarre backend (VM 1) et frontend (VM 2) en mode développement
	$(MAKE) -j2 dev-backend dev-frontend

dev-backend: ## Démarre uniquement le backend (http://localhost:$(BACKEND_PORT))
	npm --prefix $(BACKEND_DIR) run dev

dev-frontend: ## Démarre uniquement le frontend (http://localhost:$(FRONTEND_PORT))
	npm --prefix $(FRONTEND_DIR) run dev

seed: ## Réinitialise la base avec les données d'exemple
	rm -f $(BACKEND_DIR)/data/db.json
	@echo "Base réinitialisée ; elle sera ré-amorcée au prochain démarrage."

clean: clean-db ## Nettoie les artefacts de build
	rm -rf $(BACKEND_DIR)/dist $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/tsconfig.tsbuildinfo

clean-db: ## Supprime la base de données locale
	rm -f $(BACKEND_DIR)/data/db.json
