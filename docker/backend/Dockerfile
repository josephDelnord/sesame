# --- Étape de build : compilation TypeScript ---
# Contexte de build : racine du dépôt (voir docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# --- Image d'exécution : runtime minimal ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# La configuration arrive par variables d'environnement (compose),
# .env n'est volontairement pas copié dans l'image.
EXPOSE 4000
CMD ["node", "--env-file-if-exists=.env", "dist/index.js"]
