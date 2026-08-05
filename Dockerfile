FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Debian et non Alpine : la conversion des quittances en PDF passe par
# LibreOffice, dont les paquets Alpine sont incomplets et mal suivis.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# Les colonnes `timestamp` sont écrites et relues en UTC (cf. typeorm-options.ts).
ENV TZ=UTC

# `libreoffice-writer` seul : le reste de la suite (Calc, Impress, Base) pèse
# plusieurs centaines de mégaoctets sans jamais servir ici.
# `--no-install-recommends` écarte au passage les paquets de langue et Java.
#
# `fonts-crosextra-carlito` remplace le Calibri du modèle Word : mêmes métriques,
# donc même mise en page. Sans elle, LibreOffice substitue au jugé et le document
# se décale.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libreoffice-writer \
        fonts-crosextra-carlito \
        fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Sans carte graphique ni serveur X dans un conteneur, LibreOffice doit rendre
# en mémoire : sans ces deux variables, il cherche un affichage et échoue.
ENV SAL_DISABLE_OPENGL=1
ENV SAL_USE_VCLPLUGIN=svp
# LibreOffice écrit son profil dans $HOME au premier lancement ; sur Scaleway
# Serverless Containers, seul /tmp est inscriptible.
ENV HOME=/tmp

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/main"]
