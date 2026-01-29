# API Reference

Documentation complète de l'API REST HCM v1.1.

## Base URL

| Environnement | URL |
|---------------|-----|
| Local (npm) | `http://localhost:9096` |
| Docker | `http://localhost:8080/api` |

## Deux familles d'API

| Famille | Préfixe | Statut | Usage |
|---------|---------|--------|-------|
| **Enterprise** | `/v1/spaces/...` | Canonique | Nouvelle architecture spaces/workspaces/docs |
| **Legacy** | `/v1/hcm/...` | Compat | Missions, contracts, packs, atoms |

> **Recommandation** : Utilisez l'API Enterprise pour les nouvelles intégrations.

## Formats de réponse

### Routes REST directes (`/v1/hcm/missions`, `/v1/hcm/packs`, etc.)

Ces routes retournent du JSON direct sans enveloppe :

```json
{
  "mission_id": "acme-2025-q1",
  "title": "..."
}
```

En cas d'erreur :
```json
{
  "error": "MISSION_NOT_FOUND",
  "message": "Mission acme-2025-q1 not found"
}
```

### Routes avec enveloppe (`/v1/hcm/execute`, `/v1/hcm/contracts`)

Ces routes utilisent l'enveloppe HTTP v1.1 :

```json
{
  "ok": true|false,
  "data": { ... } | null,
  "error": { "code": "...", "message": "..." } | null,
  "meta": {
    "request_id": "...",
    "op": "...",
    "duration_ms": 42,
    "hcm_version": "1.1"
  }
}
```

## Codes d'erreur

| Code | HTTP | Description |
|------|------|-------------|
| `MISSION_NOT_FOUND` | 404 | Mission inexistante |
| `INVALID_PAYLOAD` | 400 | Payload malformé |
| `ACCESS_DENIED` | 403 | Accès refusé |
| `CONFLICTING_UPDATE` | 409 | Conflit de mise à jour |
| `CONTRACT_CONFLICT` | 409 | Conflit de version contrat |
| `IO_ERROR` | 500 | Erreur système fichiers |
| `INTERNAL_ERROR` | 500 | Erreur interne |
| `NOT_IMPLEMENTED` | 501 | Opération non implémentée |

---

# API Enterprise (Spaces / Workspaces / Docs)

Architecture canonique pour les nouvelles intégrations.

## Spaces

### Lister les spaces

```http
GET /v1/spaces
```

**Réponse** (200) :
```json
{
  "spaces": [
    {
      "space_id": "acme",
      "space_name": "Acme Corp",
      "description": "Espace client Acme",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Créer un space

```http
POST /v1/spaces
Content-Type: application/json

{
  "space_id": "acme",
  "space_name": "Acme Corp",
  "description": "Espace client Acme"
}
```

**Réponse** (201 si nouveau, 200 si existant) :
```json
{
  "space_id": "acme",
  "space_name": "Acme Corp",
  "description": "Espace client Acme",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

### Récupérer un space

```http
GET /v1/spaces/:spaceId
```

---

## Workspaces

### Lister les workspaces d'un space

```http
GET /v1/spaces/:spaceId/workspaces
```

**Réponse** (200) :
```json
{
  "workspaces": [
    {
      "space_id": "acme",
      "workspace_id": "projet-alpha",
      "workspace_name": "Projet Alpha",
      "description": "Transformation digitale",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### Créer un workspace

```http
POST /v1/spaces/:spaceId/workspaces
Content-Type: application/json

{
  "workspace_id": "projet-alpha",
  "workspace_name": "Projet Alpha",
  "description": "Transformation digitale"
}
```

**Réponse** (201 si nouveau, 200 si existant)

**curl** :
```bash
curl -X POST http://localhost:9096/v1/spaces/acme/workspaces \
  -H "Content-Type: application/json" \
  -d '{"workspace_id":"projet-alpha","workspace_name":"Projet Alpha"}'
```

### Récupérer un workspace

```http
GET /v1/spaces/:spaceId/workspaces/:workspaceId
```

---

## Docs (versioned)

Les docs sont versionnés avec hash SHA-256. Chaque version est immuable.

### Lister les docs d'un workspace

```http
GET /v1/spaces/:spaceId/workspaces/:workspaceId/docs
```

**Réponse** (200) :
```json
{
  "docs": [
    {
      "doc_id": "architecture-cible",
      "title": "Architecture cible",
      "doc_type": "design",
      "tags": ["architecture", "v2"],
      "version_hash": "sha256:abc123...",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ]
}
```

### Créer/Mettre à jour un doc

```http
POST /v1/spaces/:spaceId/workspaces/:workspaceId/docs
Content-Type: application/json

{
  "doc_id": "architecture-cible",
  "doc": {
    "title": "Architecture cible",
    "doc_type": "design",
    "tags": ["architecture", "v2"],
    "body": "# Architecture\n\nDescription...",
    "links": [
      { "url": "https://example.com/ref", "label": "Référence" }
    ]
  },
  "expected_base_hash": "sha256:..."
}
```

**Réponse** (201 si nouvelle version, 200 si identique) :
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
    "body": "# Architecture\n\nDescription...",
    "links": [{ "url": "https://example.com/ref", "label": "Référence" }]
  },
  "meta": {
    "version_hash": "sha256:abc123...",
    "created_at": "2025-01-15T10:00:00Z",
    "created_by": { "type": "system", "id": "enterprise-api" },
    "supersedes": "sha256:def456..."
  }
}
```

**Champs doc** :
| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `title` | string | Oui | Titre du document |
| `doc_type` | string | Non | Type (design, analysis, etc.) |
| `tags` | string[] | Non | Tags de classification |
| `body` | string | Non | Contenu markdown |
| `json` | any | Non | Données structurées |
| `links` | array | Non | Liens externes |

**Contrôle de concurrence** :
- `expected_base_hash`: Si fourni, vérifie que le doc n'a pas changé depuis cette version
- Retourne `409 CONFLICTING_UPDATE` en cas de conflit

**curl** :
```bash
curl -X POST http://localhost:9096/v1/spaces/acme/workspaces/projet-alpha/docs \
  -H "Content-Type: application/json" \
  -d '{
    "doc_id": "architecture-cible",
    "doc": {
      "title": "Architecture cible",
      "body": "# Architecture\n\nDescription..."
    }
  }'
```

### Récupérer un doc (latest)

```http
GET /v1/spaces/:spaceId/workspaces/:workspaceId/docs/:docId/latest
```

### Récupérer une version spécifique

```http
GET /v1/spaces/:spaceId/workspaces/:workspaceId/docs/:docId/versions/:version
```

Le `version` peut être avec ou sans préfixe `sha256:`.

---

## Search (scoped)

Recherche scopée à un space (et optionnellement un workspace).

```http
POST /v1/spaces/:spaceId/search
Content-Type: application/json

{
  "query": "architecture",
  "workspace_id": "projet-alpha"
}
```

**Réponse** (200) :
```json
{
  "ok": true,
  "data": {
    "count": 3,
    "results": [
      {
        "source": "domain/spaces/acme/workspaces/projet-alpha/docs/architecture-cible/latest.json",
        "score": 0.95,
        "snippet": "...architecture cible..."
      }
    ]
  },
  "meta": {
    "request_id": "ent_1234567890",
    "op": "HCM_SEARCH",
    "hcm_version": "1.1"
  }
}
```

---

# API Legacy (Missions / Contracts / Packs)

> **Note** : API maintenue pour compatibilité. Préférez l'API Enterprise pour les nouvelles intégrations.

---

## Missions

### Créer une mission

```http
POST /v1/hcm/missions
Content-Type: application/json

{
  "mission_id": "acme-2025-q1",
  "title": "Programme transformation Q1",
  "client_id": "acme-corp",
  "mission_type": "transformation"
}
```

**Réponse** (200) :
```json
{
  "mission_id": "acme-2025-q1",
  "title": "Programme transformation Q1",
  "client_id": "acme-corp",
  "created_at": "2025-01-15T10:00:00Z"
}
```

**curl** :
```bash
curl -X POST http://localhost:9096/v1/hcm/missions \
  -H "Content-Type: application/json" \
  -d '{"mission_id":"acme-2025-q1","title":"Test Mission"}'
```

### Lister les missions

```http
GET /v1/hcm/missions
GET /v1/hcm/missions?business_id=acme-corp
```

**Réponse** (200) :
```json
{
  "missions": ["acme-2025-q1", "demo-mission-001"]
}
```

### Récupérer une mission

```http
GET /v1/hcm/missions/:missionId
```

**Réponse** (200) :
```json
{
  "mission_id": "acme-2025-q1",
  "title": "Programme transformation Q1",
  "client_id": "acme-corp",
  "mission_type": "transformation",
  "created_at": "2025-01-15T10:00:00Z",
  "contract_ref": {
    "contract_id": "ctr-001",
    "contract_version": "sha256:abc123..."
  }
}
```

### Récupérer le statut d'une mission

```http
GET /v1/hcm/missions/:missionId/status
```

**Réponse** (200) :
```json
{
  "phase": "design",
  "status": "in_progress",
  "health": "ok",
  "progress": 0.45,
  "last_update": "2025-01-15T14:30:00Z"
}
```

### Archiver/Clôturer une mission

```http
PATCH /v1/hcm/missions/:missionId/status
Content-Type: application/json

{
  "action": "ARCHIVE",
  "actor": {
    "type": "human",
    "id": "jeremy.grimonpont"
  }
}
```

Actions possibles : `ARCHIVE`, `CLOSE`

---

## Contracts

### Créer/Mettre à jour un contrat

```http
POST /v1/hcm/contracts
Content-Type: application/json

{
  "contract": {
    "contract_id": "ctr-001",
    "mission_id": "acme-2025-q1",
    "contract_meta": {
      "contract_version": 1
    },
    "scope": {
      "description": "Périmètre du projet"
    },
    "deliverables": []
  },
  "expected_base_hash": "sha256:..."
}
```

**Réponse** (200) :
```json
{
  "ok": true,
  "data": {
    "contract_ref": {
      "contract_id": "ctr-001",
      "contract_version": "sha256:abc123..."
    },
    "contract": { ... }
  }
}
```

### Récupérer le contrat latest

```http
GET /v1/hcm/contracts/:contractId/latest
```

### Récupérer une version spécifique

```http
GET /v1/hcm/contracts/:contractId/versions/:version
GET /v1/hcm/contracts/:contractId/versions-int/:contractVersion
```

### Mutation de contrat

```http
POST /v1/hcm/contracts/:contractId/mutations
Content-Type: application/json

{
  "mutation": {
    "op": "ADD",
    "path": "/deliverables",
    "value": {
      "deliverable_id": "del-001",
      "title": "Rapport d'analyse"
    }
  },
  "expected_base_hash": "sha256:..."
}
```

Ou avec opérations multiples :
```json
{
  "operations": [
    {
      "op": "ensure_unique",
      "path": "/deliverables",
      "key": "deliverable_id",
      "value": { "deliverable_id": "del-001", "title": "..." }
    }
  ]
}
```

---

## Packs

### Stocker un pack

```http
POST /v1/hcm/packs
Content-Type: application/json

{
  "mission_id": "acme-2025-q1",
  "pack_id": "pack-001",
  "pack_type": "analysis",
  "payload": {
    "summary": "Analyse des entretiens",
    "data": [...]
  }
}
```

**Réponse** (200) :
```json
{
  "pack_id": "pack-001",
  "hash": "sha256:def456...",
  "storage_ref": "hcm://acme-2025-q1/packs/pack-001",
  "pack_ref": "hcm://acme-2025-q1/packs/pack-001"
}
```

### Récupérer un pack

```http
GET /v1/hcm/packs/:packId
GET /v1/hcm/packs/:packId?mission_id=acme-2025-q1
```

---

## Artifacts

### Stocker un artifact

```http
POST /v1/hcm/artifacts
Content-Type: application/json

{
  "mission_id": "acme-2025-q1",
  "artifact_id": "art-001",
  "media_type": "application/pdf",
  "content_b64": "JVBERi0xLjQK...",
  "classification": "internal",
  "filename": "rapport.pdf"
}
```

Ou avec contenu texte :
```json
{
  "mission_id": "acme-2025-q1",
  "media_type": "text/plain",
  "content": "Contenu textuel de l'artifact"
}
```

**Réponse** (200) :
```json
{
  "artifact_id": "art-001",
  "blob_hash": "sha256:...",
  "integrity": {
    "hash_algo": "sha256",
    "hash": "sha256:..."
  },
  "storage_ref": "hcm://artifacts/art-001",
  "mission_id": "acme-2025-q1"
}
```

### Récupérer un artifact

```http
GET /v1/hcm/artifacts/:artifactId
GET /v1/hcm/artifacts/:artifactId?mission_id=acme-2025-q1
```

---

## Projects

### Récupérer le contexte projet (latest)

```http
GET /v1/hcm/projects/:projectId/context/latest
```

### Récupérer une version spécifique

```http
GET /v1/hcm/projects/:projectId/context/versions/:version
```

### Créer une version de contexte

```http
POST /v1/hcm/projects/:projectId/context/versions
Content-Type: application/json

{
  "schema": "arka.project_context.v1",
  "project_meta": {
    "project_id": "proj-001",
    "document_version": "1.0.0"
  },
  "context": {
    "description": "..."
  }
}
```

---

## Atoms (stable)

### Récupérer un atom (latest)

```http
GET /v1/hcm/atoms/:atomId/latest
```

### Récupérer une version spécifique

```http
GET /v1/hcm/atoms/:atomId/versions/:version
```

---

## Execute (opérations HCM)

Point d'entrée générique pour les opérations HCM. Utilise l'enveloppe v1.1.

```http
POST /v1/hcm/execute
Content-Type: application/json

{
  "op": "HCM_GET_MISSION_CONTEXT",
  "request_id": "req-123",
  "caller": {
    "type": "agent",
    "id": "arka-pmo-01",
    "roles": ["pmo", "reader"]
  },
  "payload": {
    "mission_id": "acme-2025-q1"
  }
}
```

> **Note** : Le champ `caller.roles` est utilisé pour le contrôle d'accès (ACL). Sans rôles appropriés, certaines opérations retourneront `ACCESS_DENIED`.

### Opérations disponibles

| Operation | Description |
|-----------|-------------|
| `HCM_GET_MISSION_CONTEXT` | Récupère le contexte complet d'une mission |
| `HCM_APPEND_JOURNAL` | Ajoute une entrée au journal |
| `HCM_ADD_EVIDENCE` | Ajoute une preuve |
| `HCM_UPDATE_NEXT_ACTIONS` | Met à jour les actions |
| `HCM_GET_DECISIONS` | Récupère les décisions |
| `HCM_SEARCH` | Recherche dans le HCM |
| `HCM_LIST_MISSIONS` | Liste les missions |
| `HCM_DAY_ROLLUP` | Résumé journalier |
| `HCM_PREPARE_DAY_CONTEXT` | Prépare le contexte du jour |
| `HCM_CONTRACT_GET_LATEST` | Récupère le contrat latest |
| `HCM_CONTRACT_CREATE_VERSION` | Crée une version de contrat |
| `HCM_PACK_STORE` | Stocke un pack |
| `HCM_PACK_GET` | Récupère un pack |
| `HCM_PACK_LIST` | Liste les packs |
| `HCM_ARTIFACT_PUT` | Stocke un artifact |
| `HCM_MEMORY_QUERY` | Requête mémoire |

### Exemple : Ajouter une entrée journal

```bash
curl -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d '{
    "op": "HCM_APPEND_JOURNAL",
    "request_id": "req-001",
    "caller": {"type": "human", "id": "jeremy", "roles": ["writer"]},
    "payload": {
      "mission_id": "acme-2025-q1",
      "entry": {
        "author_type": "human",
        "author_id": "jeremy",
        "entry_type": "note",
        "message": "Réunion de lancement effectuée"
      }
    }
  }'
```

### Exemple : Recherche

```bash
curl -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d '{
    "op": "HCM_SEARCH",
    "request_id": "req-002",
    "caller": {"type": "agent", "id": "arka-search", "roles": ["reader"]},
    "payload": {
      "query": "transformation digitale"
    }
  }'
```

> **Note** : La recherche utilise le moteur Hindex configuré dans `/hcm/hindex/`. Le filtrage par scopes est géré côté Hindex (voir `classification.json` et `scopes.json`).

---

## Health Check

```http
GET /health
```

**Réponse** (200) :
```json
{
  "status": "ok",
  "hcm_root": "/hcm"
}
```

---

## Schémas de données

### JournalEntry

```typescript
{
  timestamp?: string;       // ISO-8601, auto-généré si absent
  author_type: 'agent' | 'human' | 'system';
  author_id: string;
  entry_type: 'event' | 'note' | 'analysis' | 'warning' | 'error' | 'info';
  message: string;
  context?: Record<string, unknown>;
}
```

### MissionContext

```typescript
{
  mission_id: string;
  meta: Record<string, unknown>;
  status: Record<string, unknown>;
  journal_tail: JournalEntry[];
  decisions: Record<string, unknown>[];
  next_actions: Record<string, unknown>[];
}
```

### EvidenceInput

```typescript
{
  type: string;
  title: string;
  content: unknown;
  confidence?: 'low' | 'medium' | 'high';
}
```

### NextActionUpdate

```typescript
{
  action_id?: string;
  title: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  owner_id?: string;
}
```

---

## Voir aussi

- [Examples](examples.md) : Cas d'usage complets
- [Architecture](architecture.md) : Vue système
- [HCM Structure](hcm-structure.md) : Structure des données
