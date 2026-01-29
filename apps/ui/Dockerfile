FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/ui/package.json apps/ui/package.json
COPY apps/api/package.json apps/api/package.json

RUN npm ci

COPY apps/ui ./apps/ui

RUN npm run build -w @arkalabs/hcm-ui

FROM caddy:2.8.4-alpine AS runner

COPY apps/ui/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/ui/dist /srv

EXPOSE 80

