# Examples

Cas d'usage concrets avec code pour utiliser l'API HCM.

## Prérequis

```bash
# Option 1 : Docker (recommandé)
docker compose up -d
export API_URL="http://localhost:8080/api"

# Option 2 : Local (npm)
npm run dev:api
export API_URL="http://localhost:9096"
```

> **Note** : Les exemples utilisent `${API_URL}`. Adaptez selon votre environnement :
> - **Docker** : `http://localhost:8080/api`
> - **Local** : `http://localhost:9096`

---

## 1. Créer une mission

### curl

```bash
curl -X POST ${API_URL}/v1/hcm/missions \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "demo-project-2025",
    "title": "Projet de démonstration",
    "client_id": "demo-client",
    "mission_type": "discovery",
    "tags": ["demo", "test"]
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch(`${API_URL}/v1/hcm/missions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mission_id: 'demo-project-2025',
    title: 'Projet de démonstration',
    client_id: 'demo-client',
    mission_type: 'discovery',
    tags: ['demo', 'test']
  })
});

const mission = await response.json();
console.log('Mission créée:', mission.mission_id);
```

### Réponse attendue

```json
{
  "mission_id": "demo-project-2025",
  "title": "Projet de démonstration",
  "client_id": "demo-client",
  "mission_type": "discovery",
  "tags": ["demo", "test"],
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

## 2. Ajouter une entrée au journal

### curl

```bash
curl -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d '{
    "op": "HCM_APPEND_JOURNAL",
    "request_id": "req-001",
    "caller": {
      "type": "human",
      "id": "jeremy",
      "roles": ["writer"]
    },
    "payload": {
      "mission_id": "demo-project-2025",
      "entry": {
        "author_type": "human",
        "author_id": "jeremy",
        "entry_type": "event",
        "message": "Réunion de lancement effectuée avec le client",
        "context": {
          "participants": ["jeremy", "client-sponsor"],
          "duration_minutes": 60
        }
      }
    }
  }'
```

### JavaScript

```javascript
const journalEntry = {
  op: 'HCM_APPEND_JOURNAL',
  request_id: `req-${Date.now()}`,
  caller: { type: 'human', id: 'jeremy', roles: ['writer'] },
  payload: {
    mission_id: 'demo-project-2025',
    entry: {
      author_type: 'human',
      author_id: 'jeremy',
      entry_type: 'event',
      message: 'Réunion de lancement effectuée',
      context: { participants: ['jeremy', 'client-sponsor'] }
    }
  }
};

const response = await fetch(`${API_URL}/v1/hcm/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(journalEntry)
});

const result = await response.json();
console.log('Entrée ajoutée:', result.ok);
```

---

## 3. Ajouter une evidence

### curl

```bash
curl -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d '{
    "op": "HCM_ADD_EVIDENCE",
    "request_id": "req-002",
    "caller": {
      "type": "agent",
      "id": "arka-analyst",
      "roles": ["writer", "analyst"]
    },
    "payload": {
      "mission_id": "demo-project-2025",
      "evidence": {
        "type": "interview_synthesis",
        "title": "Synthèse des entretiens utilisateurs",
        "confidence": "high",
        "content": {
          "summary": "Les utilisateurs expriment un besoin de simplification.",
          "key_findings": [
            "Processus actuel trop complexe",
            "Manque de visibilité sur l'avancement",
            "Besoin d'automatisation"
          ],
          "quotes": [
            "Je perds 2h par jour à chercher l'information",
            "On ne sait jamais où en sont les demandes"
          ]
        }
      }
    }
  }'
```

### JavaScript

```javascript
const evidence = {
  op: 'HCM_ADD_EVIDENCE',
  request_id: `req-${Date.now()}`,
  caller: { type: 'agent', id: 'arka-analyst', roles: ['writer', 'analyst'] },
  payload: {
    mission_id: 'demo-project-2025',
    evidence: {
      type: 'interview_synthesis',
      title: 'Synthèse des entretiens',
      confidence: 'high',
      content: {
        summary: 'Besoin de simplification identifié.',
        key_findings: ['Processus complexe', 'Manque de visibilité']
      }
    }
  }
};

const response = await fetch(`${API_URL}/v1/hcm/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(evidence)
});
```

---

## 4. Consulter le contexte d'une mission

### curl

```bash
curl -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d '{
    "op": "HCM_GET_MISSION_CONTEXT",
    "request_id": "req-003",
    "caller": {
      "type": "agent",
      "id": "arka-pmo",
      "roles": ["reader", "pmo"]
    },
    "payload": {
      "mission_id": "demo-project-2025"
    }
  }'
```

### Réponse attendue

```json
{
  "ok": true,
  "data": {
    "mission_id": "demo-project-2025",
    "meta": {
      "mission_id": "demo-project-2025",
      "title": "Projet de démonstration",
      "client_id": "demo-client"
    },
    "status": {
      "phase": "init",
      "status": "planned",
      "health": "ok"
    },
    "journal_tail": [
      {
        "timestamp": "2025-01-15T10:30:00Z",
        "author_type": "human",
        "author_id": "jeremy",
        "entry_type": "event",
        "message": "Réunion de lancement effectuée"
      }
    ],
    "decisions": [],
    "next_actions": []
  }
}
```

---

## 5. Créer et versionner un contrat

### Créer le contrat initial

```bash
curl -X POST ${API_URL}/v1/hcm/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "contract": {
      "contract_id": "ctr-demo-001",
      "mission_id": "demo-project-2025",
      "contract_meta": {
        "contract_version": 1,
        "title": "Contrat de découverte"
      },
      "scope": {
        "description": "Analyse des processus existants",
        "in_scope": ["Processus support", "Processus vente"],
        "out_of_scope": ["Finance", "RH"]
      },
      "deliverables": [
        {
          "deliverable_id": "del-001",
          "title": "Rapport d'analyse",
          "type": "document",
          "due_date": "2025-02-15"
        }
      ]
    }
  }'
```

### Ajouter un livrable (mutation)

```bash
curl -X POST ${API_URL}/v1/hcm/contracts/ctr-demo-001/mutations \
  -H "Content-Type: application/json" \
  -d '{
    "mutation": {
      "op": "ADD",
      "path": "/deliverables",
      "value": {
        "deliverable_id": "del-002",
        "title": "Présentation synthèse",
        "type": "presentation",
        "due_date": "2025-02-20"
      }
    }
  }'
```

### Récupérer le contrat latest

```bash
curl ${API_URL}/v1/hcm/contracts/ctr-demo-001/latest
```

---

## 6. Stocker un artifact (fichier binaire)

### Artifact texte

```bash
curl -X POST ${API_URL}/v1/hcm/artifacts \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "demo-project-2025",
    "artifact_id": "notes-reunion-001",
    "media_type": "text/markdown",
    "content": "# Notes réunion\n\n## Participants\n- Jeremy\n- Client\n\n## Points discutés\n1. Périmètre du projet\n2. Planning prévisionnel",
    "classification": "internal"
  }'
```

### Artifact binaire (base64)

```bash
# Encoder un fichier en base64
BASE64_CONTENT=$(base64 -i rapport.pdf)

curl -X POST ${API_URL}/v1/hcm/artifacts \
  -H "Content-Type: application/json" \
  -d "{
    \"mission_id\": \"demo-project-2025\",
    \"artifact_id\": \"rapport-analyse-001\",
    \"media_type\": \"application/pdf\",
    \"content_b64\": \"${BASE64_CONTENT}\",
    \"filename\": \"rapport-analyse.pdf\",
    \"classification\": \"confidential\"
  }"
```

### Récupérer un artifact

```bash
curl ${API_URL}/v1/hcm/artifacts/notes-reunion-001?mission_id=demo-project-2025
```

---

## 7. Stocker un pack de données

### curl

```bash
curl -X POST ${API_URL}/v1/hcm/packs \
  -H "Content-Type: application/json" \
  -d '{
    "mission_id": "demo-project-2025",
    "pack_id": "analysis-pack-001",
    "pack_type": "analysis_results",
    "payload": {
      "analysis_date": "2025-01-15",
      "methodology": "interviews + observation",
      "findings": [
        {
          "id": "F001",
          "category": "process",
          "severity": "high",
          "description": "Processus de validation trop long"
        },
        {
          "id": "F002",
          "category": "tools",
          "severity": "medium",
          "description": "Outils non intégrés"
        }
      ],
      "recommendations": [
        "Simplifier le circuit de validation",
        "Mettre en place un portail unifié"
      ]
    }
  }'
```

---

## 8. Rechercher dans le HCM

### curl

```bash
curl -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d '{
    "op": "HCM_SEARCH",
    "request_id": "req-search-001",
    "caller": {
      "type": "agent",
      "id": "arka-search",
      "roles": ["reader"]
    },
    "payload": {
      "query": "processus validation"
    }
  }'
```

> **Note** : La recherche utilise le moteur Hindex. Le filtrage est configuré via les fichiers `hindex/classification.json` et `hindex/scopes.json`.

---

## 9. Workflow complet : Mission discovery

Script complet simulant un workflow de mission discovery.

```bash
#!/bin/bash
set -e

API_URL="http://localhost:9096"
MISSION_ID="discovery-$(date +%Y%m%d-%H%M%S)"

echo "=== 1. Création de la mission ==="
curl -s -X POST ${API_URL}/v1/hcm/missions \
  -H "Content-Type: application/json" \
  -d "{
    \"mission_id\": \"${MISSION_ID}\",
    \"title\": \"Mission Discovery Automatisée\",
    \"mission_type\": \"discovery\"
  }" | jq .

echo -e "\n=== 2. Ajout entrée journal : Démarrage ==="
curl -s -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"op\": \"HCM_APPEND_JOURNAL\",
    \"request_id\": \"$(uuidgen)\",
    \"caller\": {\"type\": \"system\", \"id\": \"workflow\", \"roles\": [\"writer\"]},
    \"payload\": {
      \"mission_id\": \"${MISSION_ID}\",
      \"entry\": {
        \"author_type\": \"system\",
        \"author_id\": \"workflow\",
        \"entry_type\": \"event\",
        \"message\": \"Mission initialisée automatiquement\"
      }
    }
  }" | jq .ok

echo -e "\n=== 3. Création du contrat ==="
curl -s -X POST ${API_URL}/v1/hcm/contracts \
  -H "Content-Type: application/json" \
  -d "{
    \"contract\": {
      \"contract_id\": \"ctr-${MISSION_ID}\",
      \"mission_id\": \"${MISSION_ID}\",
      \"contract_meta\": {\"contract_version\": 1},
      \"scope\": {\"description\": \"Discovery automatisée\"},
      \"deliverables\": []
    }
  }" | jq .data.contract_ref

echo -e "\n=== 4. Ajout d'une evidence ==="
curl -s -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"op\": \"HCM_ADD_EVIDENCE\",
    \"request_id\": \"$(uuidgen)\",
    \"caller\": {\"type\": \"agent\", \"id\": \"arka-analyst\", \"roles\": [\"writer\", \"analyst\"]},
    \"payload\": {
      \"mission_id\": \"${MISSION_ID}\",
      \"evidence\": {
        \"type\": \"observation\",
        \"title\": \"Observation initiale\",
        \"confidence\": \"medium\",
        \"content\": {\"notes\": \"Workflow automatisé fonctionnel\"}
      }
    }
  }" | jq .ok

echo -e "\n=== 5. Récupération du contexte final ==="
curl -s -X POST ${API_URL}/v1/hcm/execute \
  -H "Content-Type: application/json" \
  -d "{
    \"op\": \"HCM_GET_MISSION_CONTEXT\",
    \"request_id\": \"$(uuidgen)\",
    \"caller\": {\"type\": \"system\", \"id\": \"workflow\", \"roles\": [\"reader\"]},
    \"payload\": {\"mission_id\": \"${MISSION_ID}\"}
  }" | jq .data

echo -e "\n=== Mission ${MISSION_ID} créée avec succès ==="
```

---

## 10. Utilisation avec JavaScript/TypeScript

### Client HCM simple

```typescript
// hcm-client.ts
class HcmClient {
  constructor(private baseUrl: string) {}

  private async execute(op: string, payload: any, caller = { type: 'system', id: 'client' }) {
    const response = await fetch(`${this.baseUrl}/v1/hcm/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op,
        request_id: `req-${Date.now()}`,
        caller,
        payload
      })
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.error?.message || 'HCM Error');
    return result.data;
  }

  async createMission(missionId: string, data: any) {
    const response = await fetch(`${this.baseUrl}/v1/hcm/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mission_id: missionId, ...data })
    });
    return response.json();
  }

  async getMissionContext(missionId: string) {
    return this.execute('HCM_GET_MISSION_CONTEXT', { mission_id: missionId });
  }

  async appendJournal(missionId: string, entry: any, caller?: any) {
    return this.execute('HCM_APPEND_JOURNAL', { mission_id: missionId, entry }, caller);
  }

  async addEvidence(missionId: string, evidence: any, caller?: any) {
    return this.execute('HCM_ADD_EVIDENCE', { mission_id: missionId, evidence }, caller);
  }

  async search(query: string, scopes?: string[]) {
    return this.execute('HCM_SEARCH', { query, scopes });
  }
}

// Utilisation
const hcm = new HcmClient('http://localhost:9096');

await hcm.createMission('my-mission', { title: 'Ma mission' });
await hcm.appendJournal('my-mission', {
  author_type: 'human',
  author_id: 'dev',
  entry_type: 'note',
  message: 'Test depuis le client TS'
});
const context = await hcm.getMissionContext('my-mission');
console.log(context);
```

---

## Voir aussi

- [API Reference](api-reference.md) : Documentation complète des endpoints
- [HCM Structure](hcm-structure.md) : Structure des données
- [Architecture](architecture.md) : Vue système
