# HCM Arka-Labs

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![HCM Version](https://img.shields.io/badge/HCM-v1.1-green.svg)](docs/concepts.md)

**HCM (Hybrid Collective Memory)** est une mémoire structurée partagée entre humains et agents IA. Ce pack open source fournit une implémentation complète avec API REST, interface utilisateur et stockage local-first.

## Quickstart Docker (3 commandes)

```bash
git clone https://github.com/arka-labs/HCM-arkalabs.app.git
cd HCM-arkalabs.app
docker compose up --build
```

- **UI** : http://localhost:8080
- **API Health** : http://localhost:8080/api/health

## Quickstart local (npm)

```bash
npm install
npm run dev:api   # Terminal 1 - API sur :9096
npm run dev:ui    # Terminal 2 - UI sur :5173
```

## Contenu du pack

| Composant | Description |
|-----------|-------------|
| `apps/api` | Service HCM (Express + stockage FS) |
| `apps/ui` | Interface web (Vite + React + Caddy) |
| `apps/api/hcm/` | Données HCM seed (fichiers JSON) |
| `docs/` | Documentation complète |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI React  │────▶│  API Express │────▶│  HCM (JSON) │
│  :5173/8080 │     │    :9096     │     │   /hcm/     │
└─────────────┘     └─────────────┘     └─────────────┘
```

Le HCM est organisé en 4 blocs :
- **stable/** : Connaissance durable (glossaires, référentiels, patterns)
- **domain/** : Contexte métier (organisation, projets, contraintes)
- **state/** : Mémoire vive (missions, journal, décisions, evidence)
- **hindex/** : Index de recherche (classification, scopes, routing)

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Guide d'installation et premier démarrage |
| [Architecture](docs/architecture.md) | Vue système et diagrammes |
| [API Reference](docs/api-reference.md) | Endpoints, schémas, exemples curl |
| [Deployment](docs/deployment.md) | Docker, configuration, production |
| [HCM Structure](docs/hcm-structure.md) | Arborescence /hcm/ détaillée |
| [Examples](docs/examples.md) | Cas d'usage concrets |
| [Concepts](docs/concepts.md) | Vocabulaire HCM |

## Persistance des données

Les données HCM sont persistées via un volume Docker (`hcm_data`). Pour réinitialiser :

```bash
docker compose down -v
```

## Licence

MIT - Voir [LICENSE](LICENSE) pour les détails.

---

**Arka-Labs** - Mémoire collective pour équipes humains + IA
