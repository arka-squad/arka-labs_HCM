# HCM Structure

Détail complet de l'arborescence `/hcm/` et du rôle de chaque fichier.

## Vue d'ensemble

```
/hcm/
├── meta.json           # Métadonnées globales HCM
├── stable/             # Bloc A - Connaissance durable
├── domain/             # Bloc B - Contexte métier
├── state/              # Bloc C - Mémoire vive
└── hindex/             # Bloc D - Index de recherche
```

## Fichier racine : meta.json

Identifie le HCM, son tenant et sa version.

```json
{
  "hcm_version": "1.0.0",
  "tenant_id": "acme-corp",
  "tenant_name": "ACME Corp",
  "environment": "production",
  "description": "Hybrid Collective Memory pour ACME Corp.",
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-15T09:00:00Z"
}
```

| Champ | Description |
|-------|-------------|
| `hcm_version` | Version du schéma HCM |
| `tenant_id` | Identifiant interne du tenant |
| `tenant_name` | Nom lisible du tenant |
| `environment` | `dev`, `staging`, `production` |

---

## Bloc A : stable/

Connaissance durable et validée.

```
stable/
├── glossary/
│   ├── core.glossary.json        # Vocabulaire de base
│   ├── domain.product.glossary.json
│   └── domain.ops.glossary.json
│
├── referentials/
│   ├── status_codes.json         # Codes de statut
│   ├── severity_levels.json      # Niveaux de sévérité
│   ├── evidence_types.json       # Types d'evidence
│   ├── mission_types.json        # Types de mission
│   └── roles_taxonomy.json       # Taxonomie des rôles
│
├── procedures/
│   ├── generic/
│   │   ├── incident_response.json
│   │   └── change_management.json
│   └── product/
│       ├── feature_lifecycle.json
│       └── release_checklist.json
│
├── patterns/
│   ├── missions/
│   │   ├── generic.discovery.pattern.json
│   │   ├── generic.audit.pattern.json
│   │   └── generic.delivery.pattern.json
│   └── evidence/
│       ├── generic.evidence_pack.pattern.json
│       └── audit.evidence_pack.pattern.json
│
├── examples/
│   ├── missions/
│   │   ├── example.mission.discovery.json
│   │   └── example.mission.audit.json
│   └── outputs/
│       ├── example.brief.json
│       └── example.report.json
│
└── atoms/
    └── <atom_id>/
        ├── latest.json
        └── versions/
            └── <version>.json
```

### glossary/*.glossary.json

```json
{
  "entries": [
    {
      "term": "mission",
      "definition": "Ensemble structuré d'objectifs et de livrables.",
      "category": "core",
      "aliases": ["projet", "engagement"]
    }
  ]
}
```

### referentials/mission_types.json

```json
{
  "mission_types": [
    {
      "code": "discovery",
      "label": "Mission de découverte",
      "description": "Compréhension du contexte et des enjeux."
    },
    {
      "code": "audit",
      "label": "Mission d'audit",
      "description": "Évaluation d'un système ou process."
    },
    {
      "code": "transformation",
      "label": "Mission de transformation",
      "description": "Pilotage d'un changement significatif."
    }
  ]
}
```

---

## Bloc B : domain/

Contexte métier spécifique au client.

```
domain/
├── org/
│   ├── org_profile.json          # Profil de l'organisation
│   ├── org_structure.json        # Structure organisationnelle
│   └── org_policies.json         # Politiques internes
│
├── business/
│   ├── products.json             # Catalogue produits
│   ├── services.json             # Services proposés
│   ├── business_capabilities.json
│   └── kpi_definitions.json      # Définitions KPI
│
├── systems/
│   ├── applications_inventory.json
│   ├── integrations_map.json
│   └── data_sources.json
│
├── constraints/
│   ├── legal_regulatory.json     # Contraintes légales
│   ├── security_policies.json    # Politiques sécurité
│   └── ai_usage_policies.json    # Politiques IA
│
└── projects/
    └── <project_id>/
        └── context/
            ├── latest.json
            └── versions/
                └── <hash>.json
```

### projects/<project_id>/context/latest.json

```json
{
  "schema": "arka.project_context.v1",
  "project_meta": {
    "project_id": "proj-001",
    "document_version": "1.0.0"
  },
  "context": {
    "description": "Contexte du projet...",
    "objectives": ["..."],
    "constraints": ["..."]
  }
}
```

---

## Bloc C : state/

Mémoire vive de l'équipe.

```
state/
├── missions/
│   └── <mission_id>/
│       ├── meta.json             # Identité de la mission
│       ├── status.json           # État courant
│       ├── journal.jsonl         # Journal (append-only)
│       ├── decisions.json        # Décisions structurées
│       ├── next_actions.json     # Actions à venir
│       │
│       ├── contracts/
│       │   ├── latest.json       # Contrat courant
│       │   └── versions/
│       │       └── <hash>.json   # Versions historiques
│       │
│       ├── evidence/
│       │   ├── ev_0001.json
│       │   └── ev_0002.json
│       │
│       ├── packs/
│       │   └── <pack_id>.json
│       │
│       ├── artifacts/
│       │   ├── blobs/
│       │   │   └── <blob_hash>
│       │   └── meta/
│       │       └── <artifact_id>.json
│       │
│       └── snapshots/
│           └── 2025-01-15T09-00-00Z.snapshot.json
│
└── team/
    ├── agents.json               # Agents Arka actifs
    ├── humans.json               # Personnes référencées
    ├── availability.json         # Disponibilités
    └── workload.json             # Charge de travail
```

### missions/<mission_id>/meta.json

```json
{
  "mission_id": "acme-2025-q1-transform",
  "title": "Programme de transformation Q1 2025",
  "client_id": "acme-corp",
  "client_name": "ACME Corp",
  "mission_type": "transformation",
  "created_at": "2025-01-15T08:30:00Z",
  "updated_at": "2025-01-15T09:12:00Z",
  "owner_human_id": "jeremy.grimonpont",
  "owner_agent_id": "arka_pmo_01",
  "tags": ["transformation", "genai", "pilot"],
  "contract_ref": {
    "contract_id": "ctr-001",
    "contract_version": "sha256:abc123..."
  }
}
```

### missions/<mission_id>/status.json

```json
{
  "phase": "design",
  "phase_label": "Conception détaillée",
  "status": "in_progress",
  "progress": 0.45,
  "last_update": "2025-01-15T09:12:00Z",
  "health": "at_risk",
  "risks": [
    {
      "risk_id": "risk-001",
      "severity": "high",
      "summary": "Dépendance forte à l'équipe data.",
      "owner": "arka_pmo_01"
    }
  ],
  "summary": "Mission en phase de conception...",
  "lifecycle": {
    "state": "ACTIVE"
  }
}
```

**Valeurs possibles** :
- `phase` : Code de phase (enum)
- `status` : `planned`, `in_progress`, `on_hold`, `done`, `cancelled`
- `health` : `ok`, `warning`, `at_risk`
- `lifecycle.state` : `ACTIVE`, `ARCHIVED`, `CLOSED`

### missions/<mission_id>/journal.jsonl

Format JSONL (une entrée JSON par ligne) :

```jsonl
{"timestamp":"2025-01-15T14:03:00Z","author_type":"agent","author_id":"arka_pmo_01","entry_type":"event","message":"Phase de cadrage validée.","context":{"phase":"cadrage"}}
{"timestamp":"2025-01-15T16:20:00Z","author_type":"human","author_id":"jeremy","entry_type":"note","message":"Clarifier le périmètre.","context":{"action_required":true}}
```

**Types d'entrée** : `event`, `note`, `analysis`, `warning`, `error`, `info`

### missions/<mission_id>/decisions.json

```json
{
  "decisions": [
    {
      "decision_id": "dec-0001",
      "timestamp": "2025-01-14T10:15:00Z",
      "made_by_type": "human",
      "made_by_id": "jeremy",
      "title": "Validation du périmètre",
      "description": "Le périmètre inclut Support et Produit.",
      "status": "validated",
      "applies_from": "2025-01-14T00:00:00Z",
      "related_phase": "cadrage",
      "impacts": ["Exclusion Finance de la phase pilote"],
      "linked_evidence_ids": ["ev-0001"]
    }
  ]
}
```

**Statuts** : `draft`, `proposed`, `validated`, `deprecated`

### missions/<mission_id>/next_actions.json

```json
{
  "next_actions": [
    {
      "action_id": "act-0001",
      "title": "Consolider la liste des systèmes",
      "description": "Recenser les applications Support et Produit.",
      "owner_type": "agent",
      "owner_id": "arka_analyst_01",
      "created_at": "2025-01-15T09:00:00Z",
      "due_date": "2025-01-17T18:00:00Z",
      "status": "in_progress",
      "priority": "high",
      "related_phase": "design"
    }
  ]
}
```

**Statuts** : `todo`, `in_progress`, `blocked`, `done`
**Priorités** : `low`, `medium`, `high`, `critical`

### missions/<mission_id>/evidence/ev_0001.json

```json
{
  "evidence_id": "ev-0001",
  "type": "interview_synthesis",
  "title": "Synthèse entretiens Support",
  "source": {
    "origin": "interviews",
    "details": "3 entretiens individuels agents Support."
  },
  "created_at": "2025-01-14T15:20:00Z",
  "created_by_type": "agent",
  "created_by_id": "arka_analyst_01",
  "confidence": "high",
  "summary": "Les agents passent 30% du temps en recherche...",
  "highlights": [
    "Temps de recherche élevé (~30%)",
    "Multiplicité d'outils (3 à 5)"
  ],
  "attachments": [
    {
      "type": "file",
      "path": "raw/interviews/support_wave1_notes.pdf"
    }
  ],
  "tags": ["support", "pain_points"]
}
```

### team/agents.json

```json
{
  "agents": [
    {
      "agent_id": "arka_pmo_01",
      "role": "pmo",
      "display_name": "Arka PMO",
      "status": "active",
      "capabilities": ["mission_planning", "risk_tracking"],
      "assigned_missions": ["acme-2025-q1-transform"],
      "last_active_at": "2025-01-15T09:05:00Z"
    }
  ]
}
```

**Statuts** : `active`, `paused`, `disabled`

### team/humans.json

```json
{
  "humans": [
    {
      "human_id": "jeremy.grimonpont",
      "display_name": "Jérémy Grimonpont",
      "email": "jeremy@example.com",
      "role": "product_manager",
      "department": "Product",
      "time_zone": "Europe/Paris",
      "preferred_language": "fr"
    }
  ]
}
```

---

## Bloc D : hindex/

Index hybride pour la recherche gouvernée.

```
hindex/
├── classification.json   # Catégories de requêtes
├── scopes.json           # Zones éligibles par classe
├── meta_rules.json       # Règles de filtrage
├── routing.json          # Stratégies de recherche
└── sources/
    ├── stable_sources.json
    ├── domain_sources.json
    └── external_sources.json
```

### classification.json

```json
{
  "classes": [
    {
      "class_id": "mission_history",
      "patterns": ["historique mission", "journal", "timeline"],
      "default_scopes": ["state/missions"]
    },
    {
      "class_id": "domain_knowledge",
      "patterns": ["produit", "organisation", "process"],
      "default_scopes": ["stable", "domain"]
    }
  ]
}
```

### scopes.json

```json
{
  "scopes": {
    "mission_history": {
      "include": ["state/missions/*/journal.jsonl", "state/missions/*/decisions.json"],
      "exclude": ["state/missions/*/artifacts/blobs/*"]
    },
    "domain_knowledge": {
      "include": ["stable/**", "domain/**"],
      "exclude": ["domain/constraints/security_policies.json"]
    }
  }
}
```

### meta_rules.json

```json
{
  "rules": [
    {
      "rule_id": "no_pii_in_search",
      "condition": "query.contains_pii",
      "action": "reject",
      "message": "La recherche contient des informations personnelles."
    },
    {
      "rule_id": "limit_results",
      "condition": "always",
      "action": "limit",
      "max_results": 50
    }
  ]
}
```

---

## Comment étendre le HCM

### Ajouter un nouveau référentiel

1. Créer le fichier dans `stable/referentials/` :
```json
// stable/referentials/my_new_codes.json
{
  "my_new_codes": [
    { "code": "...", "label": "...", "description": "..." }
  ]
}
```

2. Référencer dans `hindex/sources/stable_sources.json` si nécessaire.

### Ajouter un nouveau type d'evidence

1. Définir le type dans `stable/referentials/evidence_types.json`
2. Créer un pattern dans `stable/patterns/evidence/`
3. Documenter un exemple dans `stable/examples/`

### Ajouter un nouveau projet

```bash
mkdir -p domain/projects/my-project/context/versions
```

Puis créer le contexte via l'API :
```bash
curl -X POST http://localhost:9096/v1/hcm/projects/my-project/context/versions \
  -H "Content-Type: application/json" \
  -d '{"schema":"arka.project_context.v1","project_meta":{"project_id":"my-project"}}'
```

---

## Voir aussi

- [Architecture](architecture.md) : Vue système
- [API Reference](api-reference.md) : Manipulation via API
- [Concepts](concepts.md) : Vocabulaire HCM
