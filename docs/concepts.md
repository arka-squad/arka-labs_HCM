# Concepts (HCM)

## Définition

**HCM (Hybrid Collective Memory)** = une mémoire structurée **partagée** entre humains et agents, composée de 3 familles d’informations :

1) **Knowledge** (stable + domain)
   - *Stable* : référentiels, glossaires, patterns, procédures.
   - *Domain* : contexte métier/produit/système (non‑secret, versionnable).

2) **State** (opérationnel)
   - Missions, statuts, journal, décisions, actions suivantes, index.

3) **Evidence**
   - Artefacts produits par les runs : logs, outputs, snapshots, preuves (append‑only quand possible).

## Pourquoi “Hybrid”

Le HCM combine :
- du **JSON/FS** (déterministe, diffable, versionnable, auditable)
- une **recherche gouvernée** (Hindex : classification + scopes)
- (optionnel) des **assets binaires** (PDF/images) stockés à part, référencés par metadata.

## Hindex (recherche gouvernée)

**Hindex** = un routeur de recherche déterministe :
- **classification** : déduit une classe de requête (ex: “mission_history”, “domain_knowledge”…)
- **scopes** : définit quelles zones de données sont incluses/exclues par classe
- **routing** : stratégie (déterministe / hybride / vector) — dépend de l’implémentation

Objectif : empêcher qu’un “search” traverse des zones non pertinentes ou sensibles.

## Confidentialité (principe)

- Le HCM doit pouvoir fonctionner **sans cloud** (local‑first).
- Les règles d’accès **ne doivent pas dépendre du LLM**.
- Tout ce qui est “ambigu” doit être traité **fail‑safe** (refus / skip / warning explicite).

