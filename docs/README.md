# Documentation HCM Arka-Labs

Bienvenue dans la documentation du HCM (Hybrid Collective Memory). Ces documents sont conçus pour être "LLM-friendly" : concis, structurés et sans bruit.

## Table des matières

### Guides essentiels

| Document | Description | Public cible |
|----------|-------------|--------------|
| [Getting Started](getting-started.md) | Installation et premier démarrage | Développeurs |
| [Architecture](architecture.md) | Vue système, blocs HCM, flux de données | Architectes, Développeurs |
| [API Reference](api-reference.md) | Endpoints REST, schémas, exemples | Développeurs |

### Configuration et déploiement

| Document | Description | Public cible |
|----------|-------------|--------------|
| [Deployment](deployment.md) | Docker, variables d'env, production | DevOps, Administrateurs |
| [HCM Structure](hcm-structure.md) | Arborescence /hcm/ détaillée | Développeurs, Intégrateurs |

### Utilisation

| Document | Description | Public cible |
|----------|-------------|--------------|
| [Examples](examples.md) | Cas d'usage concrets avec code | Développeurs |
| [Concepts](concepts.md) | Vocabulaire et modèle mental HCM | Tous |

### Références techniques

| Document | Description |
|----------|-------------|
| [HCM Little](hcm-little.md) | Sous-ensemble portable pour runs CLI/Desktop |
| [Safe Sync](safe-sync.md) | Règles de synchronisation cloud sécurisée |

## Parcours de lecture suggéré

### Nouveau sur HCM ?

1. [Concepts](concepts.md) - Comprendre le vocabulaire
2. [Getting Started](getting-started.md) - Lancer l'application
3. [Architecture](architecture.md) - Comprendre la structure

### Intégrer l'API ?

1. [API Reference](api-reference.md) - Endpoints et schémas
2. [Examples](examples.md) - Cas d'usage concrets
3. [HCM Structure](hcm-structure.md) - Comprendre les données

### Déployer en production ?

1. [Deployment](deployment.md) - Configuration Docker
2. [Safe Sync](safe-sync.md) - Règles de confidentialité

## Conventions

- **Dates** : ISO 8601 (`YYYY-MM-DDTHH:MM:SSZ`)
- **Identifiants** : `snake_case` ou `kebab-case`
- **Fichiers** : UTF-8, JSON sans commentaires
- **Versions** : Schéma HCM v1.1

## Liens rapides

- [Code source API](../apps/api/src/)
- [Code source UI](../apps/ui/src/)
- [Données HCM (seed)](../apps/api/hcm/)
- [Docker Compose](../docker-compose.yml)
