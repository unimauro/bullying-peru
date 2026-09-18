# ARQUITECTURA

Fecha: 2026-09-18

## Restricción de despliegue: GitHub Pages

El observatorio se publica en **GitHub Pages**, que solo sirve archivos estáticos. No hay
backend ni base de datos en ejecución. Por eso el sistema separa el **procesamiento**
(local, reproducible) de la **presentación** (estática).

```
  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐   ┌────────────────────┐
  │  FUENTES    │   │  ETL (local) │   │  data/processed/  │   │  FRONTEND estático │
  │  oficiales  │──▶│  Python      │──▶│  *.json  *.csv    │──▶│  (GitHub Pages)    │
  │  SíseVe,    │   │  descarga,   │   │  datos limpios,   │   │  HTML+JS           │
  │  INEI, etc. │   │  limpia,     │   │  citados,         │   │  Leaflet + ECharts │
  │             │   │  normaliza,  │   │  con source_id    │   │  Chatbot (gateway) │
  └─────────────┘   │  indicadores │   └───────────────────┘   └────────────────────┘
                    └──────────────┘
```

### Capas (separadas físicamente)

| Capa | Carpeta | Contenido |
|---|---|---|
| Raw | `data/raw/` | datos crudos tal cual se descargan |
| Processed | `data/processed/` | datasets limpios/normalizados que consume el frontend |
| Analytics | `data/processed/indicators*.json` | KPIs precalculados |
| Presentation | `src/` (+ raíz para Pages) | HTML/CSS/JS estático |

## Pipeline ETL (`scripts/`)

Todos reproducibles, sin credenciales:

- `download_sources.py` — descarga/scrapea fuentes a `data/raw/`, registra `retrieval_date`.
- `clean_data.py` — limpia tipos, nulos, duplicados; escribe a `data/processed/`.
- `normalize_data.py` — normaliza territorio (UBIGEO, tildes, mayúsculas) y categorías.
- `build_indicators.py` — calcula KPIs y tasas (usa matrícula por departamento).
- `update_news.py` — actualiza el dataset de noticias.
- `data_quality.py` — genera `data_quality_report.html` (validaciones §34 del plan).

Cada dataset guarda `last_updated_at` y su `source_id`.

## Frontend estático

- **Sin framework de servidor.** HTML + JS vanilla (o build estático si se necesitara),
  para ser 100 % compatible con Pages, igual que los dashboards previos del autor.
- **Mapas:** Leaflet + GeoJSON oficial del Perú (departamentos con UBIGEO).
- **Gráficos:** Apache ECharts (o Chart.js) — series, barras, stacked, heatmaps, scatter.
- **Datos:** `fetch()` a los JSON de `data/processed/` (copiados a `src/data/` o servidos
  desde la raíz publicada).
- **Exportación:** CSV/PNG/PDF por visualización, en cliente.

## Chatbot "Pregúntale al Observatorio"

- Vía **gateway `ai.tunky.net`** (`POST /v1/chat`, header `X-Client-Token`, allowlist de
  Origin que ya incluye `unimauro.github.io`). Token se solicita a Carlos; no va al repo.
- **Guardarraíles:** responde solo con datos del dataset cargado; **cada respuesta cita
  fuente + año + URL**; prohibido inventar cifras; si no sabe, lo dice.

## Opción de backend real (no en Pages)

El modelo relacional PostgreSQL + API FastAPI del plan original está documentado en
`DATA_DICTIONARY.md`. Si en el futuro se requiere consulta dinámica, se despliega en el
**VPS** del autor (no en Pages) y el frontend estático apunta a esa API. Para el alcance
actual (datos públicos agregados), los JSON precalculados son suficientes.

## Despliegue

- Rama `main`, GitHub Pages desde la raíz (o `/docs`), cuenta `unimauro`.
- URL prevista: `https://unimauro.github.io/observatorio-bullying-peru/`.
