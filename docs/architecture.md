# Architecture HCM

Vue d'ensemble de l'architecture Hybrid Collective Memory.

## Vision globale

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Browser   │    │    CLI      │    │   Agent IA  │          │
│  │   (UI)      │    │  (Future)   │    │   (Arka)    │          │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API REST (Express)                          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ ENTERPRISE (canonique)                                   │    │
│  │  /v1/spaces                                              │    │
│  │  /v1/spaces/:spaceId/workspaces                          │    │
│  │  /v1/spaces/:spaceId/workspaces/:workspaceId/docs        │    │
│  │  /v1/spaces/:spaceId/search                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LEGACY (compat)                                          │    │
│  │  /v1/hcm/missions  /v1/hcm/contracts  /v1/hcm/packs      │    │
│  │  /v1/hcm/artifacts /v1/hcm/projects   /v1/hcm/atoms      │    │
│  │  /v1/hcm/execute   /health                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────┐      │
│  │                    HCM SERVICE                         │      │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │      │
│  │  │Contract │  │  Pack   │  │Artifact │  │ Search  │   │      │
│  │  │ Engine  │  │ Engine  │  │ Engine  │  │ Engine  │   │      │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │      │
│  │                      │                                 │      │
│  │              ┌───────┴───────┐                        │      │
│  │              │  FS Adapter   │                        │      │
│  │              └───────────────┘                        │      │
│  └───────────────────────────────────────────────────────┘      │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      HCM (File System)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐│
│  │   stable/   │ │   domain/   │ │   state/    │ │   hindex/   ││
│  │ (knowledge) │ │  (context)  │ │  (memory)   │ │  (search)   ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## API Enterprise (Spaces / Workspaces / Docs)

L'API Enterprise est le modèle **canonique** pour les intégrations. Elle organise les données en hiérarchie claire : Spaces → Workspaces → Docs.

### Routes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/v1/spaces` | Liste des spaces |
| `POST` | `/v1/spaces` | Créer un space |
| `GET` | `/v1/spaces/:spaceId` | Détail d'un space |
| `GET` | `/v1/spaces/:spaceId/workspaces` | Liste des workspaces |
| `POST` | `/v1/spaces/:spaceId/workspaces` | Créer un workspace |
| `GET` | `/v1/spaces/:spaceId/workspaces/:wsId` | Détail d'un workspace |
| `GET` | `/v1/spaces/:spaceId/workspaces/:wsId/docs` | Liste des docs |
| `POST` | `/v1/spaces/:spaceId/workspaces/:wsId/docs` | Créer/mettre à jour un doc |
| `GET` | `/v1/spaces/:spaceId/workspaces/:wsId/docs/:docId/latest` | Doc (version courante) |
| `GET` | `/v1/spaces/:spaceId/workspaces/:wsId/docs/:docId/versions/:v` | Doc (version spécifique) |
| `POST` | `/v1/spaces/:spaceId/search` | Recherche scopée au space |

### Modèle de données

**Space** :
```json
{
  "space_id": "acme",
  "space_name": "Acme Corp",
  "description": "Espace client Acme",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

**Workspace** :
```json
{
  "space_id": "acme",
  "workspace_id": "projet-alpha",
  "workspace_name": "Projet Alpha",
  "description": "Transformation digitale",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

**Doc (versioned)** :
```json
{
  "schema_version": "1.0",
  "space_id": "acme",
  "workspace_id": "projet-alpha",
  "doc_id": "architecture-cible",
  "doc": {
    "title": "Architecture cible",
    "doc_type": "design",
    "tags": ["architecture", "v2"],
    "body": "# Architecture\n...",
    "links": [{ "url": "https://...", "label": "Ref" }]
  },
  "meta": {
    "version_hash": "sha256:abc123...",
    "created_at": "2025-01-15T10:00:00Z",
    "created_by": { "type": "agent", "id": "arka-consultant" },
    "supersedes": "sha256:def456..."
  }
}
```

### Stockage FS (Enterprise)

```
domain/
└── spaces/
    └── <space_id>/
        ├── meta.json                    # SpaceMeta
        └── workspaces/
            └── <workspace_id>/
                ├── meta.json            # WorkspaceMeta
                └── docs/
                    └── <doc_id>/
                        ├── latest.json  # DocVersion courante
                        └── versions/
                            └── <hash>.json

state/
└── spaces/
    └── <space_id>/
        └── workspaces/
            └── <workspace_id>/
                ├── status.json          # État runtime
                └── journal.jsonl        # Journal append-only
```

## Les 4 blocs HCM

### Bloc A : stable/ (Connaissance durable)

Ce qui définit la "culture documentaire" d'une équipe.

```
stable/
├── glossary/           # Définitions et vocabulaire
│   ├── core.glossary.json
│   └── domain.*.glossary.json
├── referentials/       # Listes fermées, enums
│   ├── status_codes.json
│   ├── evidence_types.json
│   └── mission_types.json
├── procedures/         # Procédures intemporelles
│   ├── generic/
│   └── product/
├── patterns/           # Modèles réutilisables
│   ├── missions/
│   └── evidence/
├── examples/           # Exemples canoniques
└── atoms/              # Composants atomiques versionnés
```

**Caractéristiques** :
- Évolue lentement
- Validé par les humains
- Base de compréhension commune

### Bloc B : domain/ (Contexte métier)

Contenus liés à l'entreprise ou au client. Organisé en **Spaces** (tenants) et **Workspaces** (projets).

```
domain/
├── spaces/                              # [Enterprise] Hiérarchie spaces/workspaces
│   └── <space_id>/
│       ├── meta.json                    # SpaceMeta
│       └── workspaces/
│           └── <workspace_id>/
│               ├── meta.json            # WorkspaceMeta
│               └── docs/
│                   └── <doc_id>/
│                       ├── latest.json  # DocVersion courante
│                       └── versions/    # Historique immuable
├── org/                                 # [Legacy] Contexte organisationnel
│   ├── org_profile.json
│   ├── org_structure.json
│   └── org_policies.json
├── business/                            # [Legacy] Offre et capacités
│   ├── products.json
│   ├── services.json
│   └── kpi_definitions.json
├── systems/                             # [Legacy] Paysage SI
│   ├── applications_inventory.json
│   └── integrations_map.json
├── constraints/                         # [Legacy] Contraintes externes
│   ├── legal_regulatory.json
│   └── security_policies.json
└── projects/                            # [Legacy] Contextes projets
    └── <project_id>/
        └── context/
```

**Caractéristiques** :
- Spécifique au client/tenant
- Évolue plus fréquemment que stable/
- Non-secret, versionnable
- **Enterprise** : Docs versionnés avec hash SHA-256 et supersedes

### Bloc C : state/ (Mémoire vive)

La mémoire opérationnelle de l'équipe.

```
state/
├── spaces/                              # [Enterprise] État runtime des workspaces
│   └── <space_id>/
│       └── workspaces/
│           └── <workspace_id>/
│               ├── status.json          # État courant
│               └── journal.jsonl        # Journal append-only
├── missions/                            # [Legacy] État des missions
│   └── <mission_id>/
│       ├── meta.json           # Identité mission
│       ├── status.json         # État courant
│       ├── journal.jsonl       # Journal append-only
│       ├── decisions.json      # Décisions structurées
│       ├── next_actions.json   # Actions à venir
│       ├── contracts/          # Versions de contrat
│       │   ├── latest.json
│       │   └── versions/
│       ├── evidence/           # Preuves
│       ├── packs/              # Packs de données
│       ├── artifacts/          # Artefacts binaires
│       └── snapshots/          # Points de sauvegarde
└── team/
    ├── agents.json             # Agents Arka actifs
    └── humans.json             # Personnes référencées
```

**Caractéristiques** :
- Reflète l'instant présent
- Cœur de la continuité humain↔IA
- Structures JSON strictes
- **Enterprise** : status + journal par workspace

### Bloc D : hindex/ (Index hybride)

Pont entre recherche déterministe et RAG vectoriel.

```
hindex/
├── classification.json   # Catégories de requêtes
├── scopes.json           # Zones éligibles par classe
├── meta_rules.json       # Règles de filtrage
├── routing.json          # Stratégies de recherche
└── sources/              # Sources indexables
    ├── stable_sources.json
    ├── domain_sources.json
    └── external_sources.json
```

**Caractéristiques** :
- Optionnel mais structurant
- Prépare les requêtes avant moteur vectoriel
- Gouverne la visibilité des données

## Flux de données

### [Enterprise] Création d'un document

```
1. POST /v1/spaces/:spaceId/workspaces/:wsId/docs
   {
     "doc_id": "mon-doc",
     "doc": { "title": "Mon Document", "body": "..." }
   }

2. normalizeDocCore() → Validation et normalisation
3. calculateHash() → Hash du contenu
4. fsAdapter.writeJsonAtomic()
   ├── domain/spaces/<spaceId>/workspaces/<wsId>/docs/<docId>/versions/<hash>.json
   └── domain/spaces/<spaceId>/workspaces/<wsId>/docs/<docId>/latest.json
```

### [Enterprise] Recherche scopée

```
1. POST /v1/spaces/:spaceId/search
   { "query": "architecture", "workspace_id": "projet-alpha" }

2. hcmService.handle({ op: 'HCM_SEARCH', ... })
3. Filtrage par source (domain/spaces/<spaceId>/... ou state/spaces/<spaceId>/...)
4. Retour des résultats scopés au space/workspace
```

### [Legacy] Création d'une mission

```
1. POST /v1/hcm/missions
   └── scaffoldMission()
       ├── Crée state/missions/<id>/meta.json
       ├── Crée state/missions/<id>/status.json
       ├── Crée state/missions/<id>/journal.jsonl
       ├── Crée state/missions/<id>/decisions.json
       └── Crée state/missions/<id>/next_actions.json

2. POST /v1/hcm/contracts (optionnel)
   └── contractEngine.createVersion()
       ├── Écrit contracts/versions/<hash>.json
       └── Met à jour contracts/latest.json
```

### [Legacy] Ajout d'une entrée journal

```
1. POST /v1/hcm/execute
   {
     "op": "HCM_APPEND_JOURNAL",
     "payload": { "mission_id": "...", "entry": {...} }
   }

2. appendJournal()
   └── Append dans state/missions/<id>/journal.jsonl
```

### [Legacy] Recherche dans le HCM

```
1. POST /v1/hcm/execute
   {
     "op": "HCM_SEARCH",
     "payload": { "query": "...", "scopes": [...] }
   }

2. HindexEngine
   ├── classification.json → Détermine la classe
   ├── scopes.json → Filtre les zones
   └── Retourne les résultats triés
```

## Modèle de données

### Mission Context

```json
{
  "mission_id": "acme-2025-q1",
  "meta": {
    "title": "...",
    "client_id": "acme-corp",
    "mission_type": "transformation"
  },
  "status": {
    "phase": "design",
    "status": "in_progress",
    "health": "ok"
  },
  "journal_tail": [...],
  "decisions": [...],
  "next_actions": [...]
}
```

### Contract

```json
{
  "contract_id": "ctr-001",
  "mission_id": "acme-2025-q1",
  "contract_meta": {
    "contract_version": 1,
    "created_at": "2025-01-01T00:00:00Z"
  },
  "scope": {...},
  "deliverables": [...]
}
```

### Evidence

```json
{
  "evidence_id": "ev-0001",
  "type": "interview_synthesis",
  "title": "Synthèse entretiens Support",
  "confidence": "high",
  "summary": "...",
  "highlights": [...],
  "attachments": [...]
}
```

## Principes de conception

### 1. Déterministe

- Tout est JSON, versionnable, auditable
- Pas de dépendance au LLM pour les règles d'accès
- Comportement prévisible et reproductible

### 2. Local-first

- Fonctionne sans cloud
- Données persistées localement
- Synchronisation optionnelle

### 3. Gouverné

- Accès contrôlé par meta_rules
- Classification des données
- Fail-safe sur l'ambiguïté

### 4. Interopérable

- API REST standard
- Schémas JSON documentés
- Formats ouverts

## Intégration Docker

```
┌─────────────────────────────────────┐
│         Container arka-os           │
│                                     │
│  /app        → Code applicatif      │
│  /config     → Configuration        │
│  /hcm        → HCM (volume)         │
│  /logs       → Logs (volume)        │
└─────────────────────────────────────┘
         │
         │ volumes
         ▼
┌─────────────────────────────────────┐
│              Host                    │
│                                     │
│  ./arka-client/hcm/    → /hcm       │
│  ./arka-client/config/ → /config    │
│  ./arka-client/logs/   → /logs      │
└─────────────────────────────────────┘
```

## Voir aussi

- [HCM Structure](hcm-structure.md) : Détail de l'arborescence
- [API Reference](api-reference.md) : Endpoints REST
- [Concepts](concepts.md) : Vocabulaire HCM
