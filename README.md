# Observatorio Nacional del Bullying — Perú

> Datos, tendencias y evidencia sobre acoso escolar y ciberbullying en el Perú.

Sistema de inteligencia y visualización de datos sobre el bullying, el ciberbullying
y la violencia escolar en el Perú, construido **exclusivamente con datos verificables**
y con **prioridad absoluta a fuentes oficiales peruanas**.

## Principio rector

**No se inventan cifras.** Cada número del observatorio es trazable a una fuente con
URL. Cuando un dato no existe, se declara explícitamente en [`docs/DATA_GAPS.md`](docs/DATA_GAPS.md).
Se distingue rigurosamente entre **bullying**, **ciberbullying** y **violencia escolar**,
y entre **registros administrativos** (SíseVe = *reportes de presuntos hechos*) y
**exposición medida** por encuestas a estudiantes.

## Arquitectura (adaptada a GitHub Pages)

GitHub Pages sirve solo archivos estáticos, así que el sistema separa el procesamiento
(local, reproducible) de la presentación (estática):

```
FUENTES  →  ETL Python (local)  →  data/processed/*.json  →  Frontend estático (GitHub Pages)
(oficiales)  scripts/*.py          (datos limpios+citados)    HTML + Leaflet + ECharts
```

- **ETL** (`scripts/`): descarga, limpia, normaliza y calcula indicadores. Reproducible.
- **Datos procesados** (`data/processed/`): JSON/CSV que consume el frontend, cada uno
  con su `source_id`.
- **Frontend** (`src/`, publicado en la raíz para Pages): dashboard, mapa coroplético,
  series históricas, explorador, exportación.
- **Chatbot** "Pregúntale al Observatorio" vía gateway `ai.tunky.net`, con citación
  obligatoria y prohibido inventar cifras.

> El modelo de datos relacional (PostgreSQL) del plan original está **documentado** en
> `docs/DATA_DICTIONARY.md` y materializado como JSON. No se requiere servidor para Pages;
> una API real (FastAPI) es opcional y va al VPS, no a Pages.

## Estructura del repositorio

```
data/
  raw/         # datos crudos tal como se descargan (no versionados salvo muestras)
  processed/   # datasets limpios y normalizados (JSON/CSV) que consume el frontend
  metadata/    # catálogo de fuentes, diccionarios, calidad
  geo/         # GeoJSON oficial del Perú (departamentos, UBIGEO)
  news/        # dataset de noticias curadas
scripts/       # pipeline ETL reproducible (Python)
  download_sources.py, clean_data.py, normalize_data.py,
  build_indicators.py, update_news.py
docs/          # SOURCE_CATALOG, DATA_DICTIONARY, METHODOLOGY, ARCHITECTURE, DATA_GAPS
src/           # frontend estático (css/js/data)
```

## Fase actual

**Fase 1 — Investigación de fuentes.** Antes de implementar el dashboard se catalogan
y documentan todas las fuentes. Ver [`docs/`](docs/):

- [`SOURCE_CATALOG.md`](docs/SOURCE_CATALOG.md) — catálogo de fuentes
- [`DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md) — modelo y variables
- [`METHODOLOGY.md`](docs/METHODOLOGY.md) — definiciones, tratamiento, límites
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura técnica
- [`DATA_GAPS.md`](docs/DATA_GAPS.md) — datos que no existen o no se hallaron

## Licencia y datos

Los datos pertenecen a sus fuentes originales (MINEDU/SíseVe, INEI, Defensoría, etc.);
este repositorio solo los reorganiza de forma agregada y citada. **Nunca** se publican
datos personales de menores.

### Documentación adicional (25-09-2026)
- `docs/AUDITORIA-FUENTES.md` — auditoría de fuentes S1–S6, cadena de custodia del microdato SíseVe y qué verificamos nosotros.
- `docs/MODELO-INSTITUCIONAL.md` — institución vs servicio (código modular) vs local; reglas de agregación y de territorio.
- `docs/PIPELINE.md` — orden de los scripts, verificaciones y privacidad como puerta.
- `docs/SOLICITUD-TRANSPARENCIA.md` — solicitud lista para presentar al MINEDU (Ley 27806), sin datos personales.
