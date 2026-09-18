# DICCIONARIO DE DATOS

Fecha: 2026-09-18

Modelo de datos normalizado del observatorio. Se documenta como esquema relacional
(compatible con PostgreSQL) y se **materializa como JSON** en `data/processed/` para el
frontend estático. Los valores concretos y sus fuentes se registran en
[`SOURCE_CATALOG.md`](SOURCE_CATALOG.md).

## Tabla `incidents` (hechos reportados / agregados)

| Campo | Tipo | Descripción |
|---|---|---|
| `year` | int | Año del reporte |
| `month` | int \| null | Mes (si la fuente lo desglosa) |
| `department` | text | Departamento (normalizado) |
| `province` | text \| null | Provincia |
| `district` | text \| null | Distrito |
| `ubigeo` | text \| null | Código UBIGEO oficial |
| `education_level` | enum | inicial / primaria / secundaria / otro |
| `school_type` | enum | pública / privada |
| `management_type` | text \| null | tipo de gestión detallado |
| `geographic_area` | enum | urbano / rural |
| `victim_sex` | enum | mujer / hombre / no especificado |
| `aggressor_sex` | enum \| null | mujer / hombre / no especificado |
| `violence_type` | text | física / psicológica / sexual / verbal / ... (según fuente) |
| `bullying_type` | text \| null | físico / psicológico / verbal / social / sexual / digital |
| `cyberbullying` | bool | si el hecho es ciberbullying |
| `case_status` | text \| null | estado de atención |
| `number_cases` | int | conteo agregado |
| `source_id` | text | FK a `sources` |
| `data_nature` | enum | `registro_administrativo` / `exposicion_medida` |
| `is_estimated` | bool | true si algún valor fue estimado (marcado) |

## Tabla `sources`

| Campo | Tipo | Descripción |
|---|---|---|
| `source_id` | text | Identificador único |
| `source_name` | text | Nombre de la fuente |
| `institution` | text | Institución responsable |
| `source_type` | enum | registro_admin / encuesta / informe / academico / prensa / normativa |
| `url` | text | URL directa |
| `publication_date` | date \| null | Fecha de publicación |
| `data_period` | text | Período que cubre el dato |
| `geographic_scope` | text | nacional / departamental / distrital |
| `methodology` | text | Descripción metodológica |
| `retrieval_date` | date | Fecha de consulta/descarga |
| `original_dataset` | text \| null | Nombre/URL del dataset original |
| `reliability_level` | enum | A / B / C / D |
| `notes` | text | Advertencias |

## Tabla `population` (para tasas)

| Campo | Tipo | Descripción |
|---|---|---|
| `year` | int | Año |
| `department` | text | Departamento |
| `ubigeo` | text \| null | UBIGEO departamental |
| `education_level` | enum \| null | nivel (si desglosado) |
| `students` | int | Matrícula estudiantil |
| `source_id` | text | FK a `sources` |

## Tabla `news`

| Campo | Tipo | Descripción |
|---|---|---|
| `date` | date | Fecha |
| `title` | text | Titular |
| `media` | text | Medio |
| `url` | text | Enlace |
| `department` | text \| null | Región |
| `topic` | text | bullying / ciberbullying / violencia_escolar / politica |
| `summary` | text | Resumen |
| `verification_level` | enum | REPORTADO / INVESTIGACION_PERIODISTICA / CONFIRMADO_OFICIAL / NO_VERIFICADO |

## Tabla `legislation`

| Campo | Tipo | Descripción |
|---|---|---|
| `law` | text | Norma (ley/DS/resolución) |
| `date` | date | Fecha |
| `institution` | text | Institución |
| `description` | text | Descripción |
| `status` | text | vigente / modificada / derogada |
| `url` | text | Fuente oficial |

## Enumeraciones normalizadas

- **departamento:** los 24 departamentos + Provincia Constitucional del Callao + Lima
  Metropolitana (según desglose de la fuente). Normalización en `normalize_data.py`.
- **data_nature:** `registro_administrativo` (SíseVe) vs `exposicion_medida` (encuestas).
  **No se agregan entre sí.**

## Materialización JSON (frontend)

- `data/processed/incidents.json` — serie/agregados de incidentes.
- `data/processed/timeseries.json` — series históricas por año y categoría.
- `data/processed/by_department.json` — agregados y tasas por departamento y año.
- `data/processed/population.json` — matrícula por departamento/año.
- `data/processed/indicators.json` — KPIs precalculados.
- `data/processed/sources.json` — catálogo de fuentes (para citación en UI).
- `data/news/news.json` — noticias.
- `data/processed/legislation.json` — línea de tiempo normativa.
