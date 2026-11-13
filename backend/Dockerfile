# --- Étape de build : compilation TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Image d'exécution : runtime minimal ---
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# La configuration arrive par variables d'environnement (compose),
# .env n'est volontairement PAS copié dans l'image.
EXPOSE 4000
CMD ["node", "--env-file-if-exists=.env", "dist/index.js"]
