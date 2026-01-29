# HCM Little (portable)

## But

**HCM Little** = un sous‑ensemble portable du HCM destiné à être **embarqué** avec un run (CLI/Desktop) pour :
- retrouver vite le contexte utile (référentiels, glossaire, règles, état minimal)
- produire de l’évidence localement sans dépendre du réseau

## Contenu minimum utile (V0.1)

1) **Hindex minimal**
   - classification + scopes + meta_rules
   - objectif : recherche déterministe et bornée

2) **Knowledge minimal**
   - stable : glossaire + référentiels nécessaires au produit
   - domain : description produit/système (non‑secret)

3) **State minimal pour un run**
   - `mission_id`
   - status (phase/health)
   - journal (append-only) ou timeline minimale
   - pointeurs vers evidence

4) **Evidence locale**
   - outputs, logs, snapshots (structure stable)
   - lien vers artefacts binaires (optionnel)

## Invariants

- **Lisible par un humain** (JSON clair, pas d’obfuscation).
- **Stable pour un builder** (schémas stables, champs présents même vides).
- **Pas d’écriture libre par le LLM** : toute écriture passe par des opérations explicites (API/CLI) avec validation.

