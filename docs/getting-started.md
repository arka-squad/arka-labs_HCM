# Getting Started

Guide d'installation et de premier démarrage de HCM Arka-Labs.

## Prérequis

| Outil | Version minimale | Vérification |
|-------|------------------|--------------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| Node.js (optionnel) | 18+ | `node --version` |
| npm (optionnel) | 9+ | `npm --version` |

## Installation

### Option 1 : Docker (recommandé)

```bash
# Cloner le repository
git clone https://github.com/arka-labs/HCM-arkalabs.app.git
cd HCM-arkalabs.app

# Démarrer les services
docker compose up --build
```

Services disponibles :
- **UI** : http://localhost:8080
- **API** : http://localhost:8080/api (via proxy Caddy)

### Option 2 : Installation locale (npm)

```bash
# Cloner et installer les dépendances
git clone https://github.com/arka-labs/HCM-arkalabs.app.git
cd HCM-arkalabs.app
npm install

# Terminal 1 : Démarrer l'API
npm run dev:api

# Terminal 2 : Démarrer l'UI
npm run dev:ui
```

Services disponibles :
- **UI** : http://localhost:5173
- **API** : http://localhost:9096

## Vérification de l'installation

### 1. Test de santé API

```bash
curl http://localhost:9096/health
# ou via proxy Docker
curl http://localhost:8080/api/health
```

Réponse attendue :
```json
{
  "status": "ok",
  "hcm_root": "/hcm"
}
```

### 2. Lister les missions

```bash
curl http://localhost:9096/v1/hcm/missions
```

Réponse attendue :
```json
{
  "missions": ["demo-mission-001", "..."]
}
```

### 3. Interface utilisateur

Ouvrir http://localhost:5173 (local) ou http://localhost:8080 (Docker).

L'UI doit afficher :
- Liste des missions existantes
- Possibilité de naviguer dans le HCM
- Recherche dans les documents

## Structure des dossiers

```
HCM-arkalabs.app/
├── apps/
│   ├── api/           # Service Express (TypeScript)
│   │   ├── src/
│   │   ├── hcm/       # Données HCM seed (JSON)
│   │   │   ├── stable/    # Connaissance durable
│   │   │   ├── domain/    # Contexte métier
│   │   │   ├── state/     # Mémoire vive
│   │   │   └── hindex/    # Index de recherche
│   │   └── Dockerfile
│   └── ui/            # Interface React (Vite + Caddy)
│       ├── src/
│       ├── Caddyfile
│       └── Dockerfile
├── docs/              # Documentation
├── schemas/           # Schémas JSON (validation)
└── docker-compose.yml
```

> **Note** : En Docker, les données HCM sont copiées dans un volume persistant (`hcm_data`) monté sur `/hcm`.

## Configuration

### Variables d'environnement

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `9096` | Port de l'API |
| `HCM_ROOT` | `./hcm` | Chemin racine du HCM |
| `CORS_ORIGIN` | `http://localhost:5173` | Origines CORS autorisées |

### Fichier .env (optionnel)

```bash
# .env
PORT=9096
HCM_ROOT=/path/to/hcm
CORS_ORIGIN=http://localhost:5173,http://localhost:8080
```

## Dépannage

### L'API ne démarre pas

```bash
# Vérifier les logs
docker compose logs api

# Vérifier que le port n'est pas utilisé
lsof -i :9096
```

### L'UI ne charge pas les données

1. Vérifier que l'API est accessible :
   ```bash
   curl http://localhost:9096/health
   ```

2. Vérifier la configuration CORS dans les logs API

3. Vérifier la variable `VITE_API_URL` de l'UI

### Réinitialiser les données

```bash
# Supprimer le volume Docker
docker compose down -v

# Ou en local, supprimer le dossier state/missions/
rm -rf apps/api/hcm/state/missions/*
```

## Étapes suivantes

- [Architecture](architecture.md) : Comprendre la structure HCM
- [API Reference](api-reference.md) : Explorer les endpoints
- [Examples](examples.md) : Cas d'usage concrets
