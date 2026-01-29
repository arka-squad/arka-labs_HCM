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
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  /v1/hcm/missions  /v1/hcm/contracts  /v1/hcm/packs    │    │
│  │  /v1/hcm/artifacts /v1/hcm/projects   /v1/hcm/atoms    │    │
│  │  /v1/hcm/execute   /health                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────┐      │
│  │                    HCM SERVICE                         │      │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │      │
│  │  │Contract │  │  Pack   │  │Artifact │  │  Chat   │   │      │
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

Contenus liés à l'entreprise ou au client.

```
domain/
├── org/                # Contexte organisationnel
│   ├── org_profile.json
│   ├── org_structure.json
│   └── org_policies.json
├── business/           # Offre et capacités
│   ├── products.json
│   ├── services.json
│   └── kpi_definitions.json
├── systems/            # Paysage SI
│   ├── applications_inventory.json
│   └── integrations_map.json
├── constraints/        # Contraintes externes
│   ├── legal_regulatory.json
│   └── security_policies.json
└── projects/           # Contextes projets
    └── <project_id>/
        └── context/
```

**Caractéristiques** :
- Spécifique au client/tenant
- Évolue plus fréquemment que stable/
- Non-secret, versionnable

### Bloc C : state/ (Mémoire vive)

La mémoire opérationnelle de l'équipe.

```
state/
├── missions/
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

### Création d'une mission

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

### Ajout d'une entrée journal

```
1. POST /v1/hcm/execute
   {
     "op": "HCM_APPEND_JOURNAL",
     "payload": { "mission_id": "...", "entry": {...} }
   }

2. appendJournal()
   └── Append dans state/missions/<id>/journal.jsonl
```

### Recherche dans le HCM

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
