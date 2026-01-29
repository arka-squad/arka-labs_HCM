# Deployment Guide

Guide de déploiement HCM Arka-Labs pour environnements de développement et production.

## Architecture de déploiement

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Host                           │
│                                                         │
│  ┌─────────────────┐      ┌─────────────────┐          │
│  │   web (Caddy)   │      │   api (Express) │          │
│  │     :80         │─────▶│     :9096       │          │
│  └────────┬────────┘      └────────┬────────┘          │
│           │                        │                    │
│           │                        │                    │
│  ┌────────┴────────────────────────┴────────┐          │
│  │              Volume: hcm_data             │          │
│  │                  /hcm/                    │          │
│  └───────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
              │
              │ :8080
              ▼
         Utilisateurs
```

## Docker Compose

### Configuration de base

```yaml
# docker-compose.yml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      PORT: "9096"
      HCM_ROOT: "/hcm"
      CORS_ORIGIN: "http://localhost:8080"
    volumes:
      - hcm_data:/hcm

  web:
    build:
      context: .
      dockerfile: apps/ui/Dockerfile
    depends_on:
      - api
    ports:
      - "8080:80"

volumes:
  hcm_data:
```

### Commandes Docker

```bash
# Démarrage
docker compose up -d

# Démarrage avec rebuild
docker compose up --build -d

# Logs
docker compose logs -f
docker compose logs api
docker compose logs web

# Arrêt
docker compose down

# Arrêt avec suppression des volumes (reset données)
docker compose down -v

# Statut
docker compose ps
```

## Variables d'environnement

### API

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| `PORT` | Non | `9096` | Port d'écoute de l'API |
| `HCM_ROOT` | Non | `./hcm` | Chemin racine du HCM |
| `CORS_ORIGIN` | Non | `http://localhost:5173` | Origines CORS (séparées par `,`) |

### Exemples de configuration CORS

```bash
# Origine unique
CORS_ORIGIN=http://localhost:8080

# Origines multiples
CORS_ORIGIN=http://localhost:8080,http://localhost:5173,https://app.example.com

# Toutes origines (déconseillé en production)
CORS_ORIGIN=*
```

### UI

| Variable | Requis | Défaut | Description |
|----------|--------|--------|-------------|
| `VITE_API_URL` | Non | `/api` | URL de base de l'API |

## Volumes et persistance

### Structure des volumes

```
hcm_data/
├── meta.json           # Métadonnées HCM
├── stable/             # Connaissance durable
├── domain/             # Contexte métier
├── state/              # Mémoire vive
│   ├── missions/
│   └── team/
└── hindex/             # Index de recherche
```

### Sauvegarde des données

```bash
# Backup du volume
docker run --rm \
  -v hcm-arkalabsapp_hcm_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/hcm-backup-$(date +%Y%m%d).tar.gz -C /data .

# Restauration
docker run --rm \
  -v hcm-arkalabsapp_hcm_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/hcm-backup-20250115.tar.gz"
```

### Montage de données existantes

```yaml
# docker-compose.override.yml
services:
  api:
    volumes:
      - ./my-hcm-data:/hcm  # Données locales au lieu du volume Docker
```

## Configuration production

### docker-compose.prod.yml

```yaml
services:
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      PORT: "9096"
      HCM_ROOT: "/hcm"
      CORS_ORIGIN: "https://hcm.example.com"
      NODE_ENV: "production"
    volumes:
      - hcm_data:/hcm
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9096/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  web:
    build:
      context: .
      dockerfile: apps/ui/Dockerfile
      args:
        VITE_API_URL: /api
    depends_on:
      api:
        condition: service_healthy
    ports:
      - "443:443"
      - "80:80"
    restart: unless-stopped
    volumes:
      - ./caddy/Caddyfile.prod:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config

volumes:
  hcm_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/hcm  # Chemin persistant sur l'hôte
  caddy_data:
  caddy_config:
```

### Configuration Caddy production

L'UI utilise Caddy comme serveur web et reverse proxy. Configuration de base dans `apps/ui/Caddyfile`.

Pour la production avec HTTPS automatique :

```caddyfile
# caddy/Caddyfile.prod
hcm.example.com {
    # Proxy API
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy api:9096
    }

    # SPA - fichiers statiques
    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }

    # Headers de sécurité
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
    }
}
```

> **Note** : Caddy gère automatiquement les certificats HTTPS via Let's Encrypt.

## Checklist production

### Sécurité

- [ ] HTTPS configuré (automatique avec Caddy)
- [ ] CORS restreint aux domaines autorisés
- [ ] Headers de sécurité configurés dans Caddyfile
- [ ] Pas de `CORS_ORIGIN=*`
- [ ] Volumes montés en lecture seule si possible

### Performance

- [ ] Health checks configurés
- [ ] Restart policy défini (`unless-stopped`)
- [ ] Logs configurés (rotation, niveau)
- [ ] Ressources limitées (memory, cpu)

### Résilience

- [ ] Backups automatisés
- [ ] Monitoring configuré
- [ ] Alertes sur health check failures
- [ ] Plan de reprise documenté

### Maintenance

- [ ] Documentation des procédures
- [ ] Accès aux logs centralisé
- [ ] Procédure de mise à jour documentée

## Monitoring

### Health check

```bash
# Vérification simple
curl -f http://localhost:9096/health

# Avec jq pour parsing
curl -s http://localhost:9096/health | jq .

# Script de monitoring
#!/bin/bash
if ! curl -sf http://localhost:9096/health > /dev/null; then
    echo "HCM API is down!"
    # Envoyer alerte...
fi
```

### Logs

```bash
# Logs en temps réel
docker compose logs -f api

# Dernières 100 lignes
docker compose logs --tail=100 api

# Logs avec timestamp
docker compose logs -t api
```

## Mise à jour

### Procédure standard

```bash
# 1. Pull des dernières modifications
git pull origin main

# 2. Rebuild et redémarrage
docker compose up --build -d

# 3. Vérification
docker compose ps
curl http://localhost:9096/health
```

### Rollback

```bash
# 1. Identifier la version précédente
git log --oneline -5

# 2. Checkout de la version précédente
git checkout <commit-hash>

# 3. Rebuild
docker compose up --build -d
```

## Voir aussi

- [Getting Started](getting-started.md) : Installation initiale
- [Architecture](architecture.md) : Vue système
- [Safe Sync](safe-sync.md) : Règles de synchronisation
