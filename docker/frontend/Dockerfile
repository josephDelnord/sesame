# --- Étape de build : compilation Vite ---
# Contexte de build : racine du dépôt (voir docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# URL de l'API : vide par défaut (même origine, nginx proxifie /api vers le backend).
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Image d'exécution : serveur statique nginx + proxy /api ---
FROM nginx:1.27-alpine
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
