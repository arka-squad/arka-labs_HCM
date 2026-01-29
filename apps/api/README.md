# @arkalabs/hcm-service

Service HCM (Hybrid Collective Memory) **local-first**.

Objectif : fournir une API simple, portable et auto‑hébergeable pour :
- stocker et relire des connaissances structurées (JSON)
- gérer un “state” de missions (status/journal/evidence)
- effectuer des recherches déterministes via Hindex (scopes + classification)

## Démarrage rapide

```bash
cd ../../..
npm install

# Terminal 1
npm run dev:api

# Terminal 2
npm run dev:ui
```

Par défaut, le service démarre sur `http://localhost:9096` et utilise un stockage local `./hcm`.

## Variables d’environnement

- `PORT` (défaut `9096`)
- `HCM_ROOT` (défaut `./hcm`)
- `CORS_ORIGIN` (défaut `http://localhost:5173`)

