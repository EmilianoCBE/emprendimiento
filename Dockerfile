# Un solo artefacto: la API sirve la web. Se ejecuta sin privilegios de root.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 TRUST_PROXY=true
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --omit=dev
COPY apps/api/src apps/api/src
COPY apps/api/migrations apps/api/migrations
COPY apps/api/tsconfig.json apps/api/
COPY packages/contracts/src packages/contracts/src
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p apps/api/uploads && chown -R node:node apps/api/uploads
USER node
EXPOSE 4000
CMD ["npx", "tsx", "apps/api/src/main.ts"]
