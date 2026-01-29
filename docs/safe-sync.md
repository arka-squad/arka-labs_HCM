# Safe Sync (cloud)

## Objectif

Permettre un usage en équipe **sans fuite** :
- partager “où on en est” (résumé/état)
- rendre visible une mission et ses traces **sans monter les données sensibles**

## Règles V0.1 (contrat fonctionnel)

### Ce qui peut monter (allowlist)
- méta mission (id, titre, timestamps)
- status (phase/health)
- résumés “safe” (texte filtré, pas de secrets/PII)
- index minimal (pointeurs, compteurs)

### Ce qui ne monte jamais (denylist)
- secrets (tokens, clés, credentials)
- PII (emails, numéros, adresses) sauf stratégie explicite
- payloads bruts non filtrés, logs complets, dumps
- pièces jointes binaires sans classification

### Gestion de l’ambiguïté
- **fail** si l’objet n’est pas classé ou non conforme
- ou **skip + warn** si configuré (mais jamais “silent”)

### Opt-out par mission
- mode “no-sync” : rien ne monte, mais l’exécution locale continue
- le cloud peut refléter uniquement “mission invisible / local-only” si nécessaire (sans contenu)

## Lifecycle mission côté cloud (V0.1)

- statuts : planned → running → finished → archived
- écriture autorisée :
  - Studio : création/metadata
  - CLI/Desktop : status + safe summaries + evidence index (pas de payload brut)
  - orchestrateur externe : déclenchements/liaisons (hors Arka‑Labs)

## Confidentialité & rétention

- TTL court par défaut pour les résumés et états (configurable)
- pas de logs bruts en cloud V0.1
- audit minimal : “qui a sync quoi” (métadonnées, pas contenu)

