# El pipeline de datos

Qué script lee qué y escribe qué, en qué orden, y la trampa a evitar. Inspirado en
`docs/PIPELINE.md` del
[Observatorio de Violencia Escolar](https://github.com/fiorellatl/observatorio-violencia-escolar),
adaptado a este repositorio (sitio estático, sin build; Python 3 stdlib salvo donde se
indica).

## Fuentes de entrada

| Entrada | Dónde vive | Cómo llega |
|---|---|---|
| Capa pública del microdato SíseVe (`national.json`, `territorio.json`, `correlacion.json`, `meta.json`, `schools_index.json`) | `data/raw/observatorio-escolar/` (**versionado**, excepción en `.gitignore`) | `curl` desde `raw.githubusercontent.com/fiorellatl/observatorio-violencia-escolar/main/data/public/` |
| `schools_detail.json` (14 MB, por colegio × año × tipo) | `data/raw/observatorio-escolar/` (**git-ignored**) | idem; `build_schools_v2.py` lo descarga si falta |
| GeoJSON distrital crudo (juaneladio/peru-geojson) | `data/raw/` (git-ignored) | `build_by_district.py` lo descarga y adelgaza |
| Tablero oficial SíseVe (mensual 2024–2026) | — | `scrape_siseve.py` (navegador headless, 1 lectura/página) |
| Noticias (Google News RSS, allowlist de medios) | `data/news/news.json` | `update_news.py` (cron diario en GitHub Actions) |

Ningún archivo caso-por-caso existe en este repo. Ver `AUDITORIA-FUENTES.md` §0.

## Los pasos

| # | Script | Lee | Escribe |
|---|---|---|---|
| 1 | `scripts/integrar_siseve_microdato.py` | `data/raw/observatorio-escolar/{national,territorio,correlacion,meta}.json`, `population.json`, `by_department.json` (2022/2026 previos) | `timeseries.json`, `territory.json`, `by_department.json` (año 2024), `correlation.json` |
| 2 | `scripts/build_schools_v2.py` | `schools_index.json` + `schools_detail.json` (raw) | `schools_index.json` (con `y[14]`), `schools_top.json`, `schools_detail/<región>.json` + `_index.json` |
| 3 | `scripts/build_by_district.py` | `data/processed/schools_index.json` (paso 2) + GeoJSON distrital | `data/geo/peru-distrital.geojson`, `by_district.json` |
| 4 | `scripts/scrape_siseve.py` | tablero oficial | `monthly.json` (y validación de totales) |
| 5 | `scripts/build_indicators.py` | `timeseries.json`, `population.json` | `indicators.json` |
| 6 | `scripts/update_news.py` | RSS | `data/news/news.json` (cron) |

**El orden importa**: 3 depende de 2 (necesita `y[14]`); 5 depende de 1. Los pasos
1–3 son deterministas y se pueden re-ejecutar siempre.

```bash
python3 scripts/integrar_siseve_microdato.py
python3 scripts/build_schools_v2.py
python3 scripts/build_by_district.py
python3 scripts/build_indicators.py
```

## La trampa

`by_department.json` es a la vez **entrada y salida** del paso 1: el script conserva
los años 2022 (boletín) y 2026 (prensa) que ya estaban y reescribe solo 2024. Si se
borra el archivo, el paso 1 falla en lugar de inventar 2022 y 2026: correcto, pero
hay que saberlo. `timeseries.json` **sí** se regenera entero (sus `year_notes` viven
en el script).

Regla de frescura que aplicamos a mano (no hay orquestador): **una salida está
obsoleta si alguna de sus entradas es más reciente**. Antes de commitear, `ls -lt
data/processed/` y comparar con `data/raw/`.

## Verificaciones que no son ceremonia

Cada script aborta si falla una aserción; no escribe a medias:

- Paso 1: `física + psicológica + sexual == total` y `entre_escolares + personal_ie
  == total` en los 14 años; 25 regiones casan con `population.json`.
- Paso 2: `Σ y == t` por colegio; `Σ t == 122,984`; mismos slugs en índice y detalle;
  25 shards; años exactamente 2013..2026.
- Paso 3: cobertura del match (distritos y % de reportes) impresa y guardada en
  `coverage`/`sin_match`; distritos sin polígono **no** se imputan.
- Frontend: `node --check src/js/*.js` y `python3 -c json.load` sobre todo
  `data/processed/**` antes de push (ver la sección «Validación» del README).

## Privacidad como puerta, no como convención

- El único punto que toca la red es la descarga de la capa pública ya agregada.
- Si en el futuro entra un XLSX caso-por-caso (solicitud propia), vivirá en
  `data/raw/` (git-ignored), se agregará en un script que **declare las columnas que
  nunca lee** (edad, sexo, grado, turno, idioma del agredido; sexo/edad/relación del
  agresor; dirección), con supresión de celdas < 5 en cortes sensibles, y una
  comprobación automática que falle si alguna de esas columnas aparece en
  `data/processed/`.

## Cuando llegue una tanda nueva

1. Actualizar los JSON en `data/raw/observatorio-escolar/` (o el XLSX propio en
   `data/raw/`).
2. Ejecutar los pasos 1 → 2 → 3 → 5 en ese orden; leer las verificaciones.
3. Actualizar `retrieval_date`/`corte` (los scripts lo hacen) y `docs/DATA_GAPS.md`.
4. `node --check` + validación JSON; subir la versión de cache-busting (`?v=`) en
   `index.html` para que los navegadores no sirvan JS viejo.
5. `git push` (archivos grandes: `git -c http.postBuffer=524288000 push`).

## Lo que este pipeline todavía no arregla

- Depende de que un tercero (fiorellatl) publique la capa agregada; la independencia
  real llega con nuestra propia solicitud de transparencia
  (`SOLICITUD-TRANSPARENCIA.md`).
- No hay orquestador con comprobación de frescura por fecha; es manual.
- `schools_detail/` (9.3 MB) y `schools_index.json` (4.5 MB) viven en el repo: bien
  para GitHub Pages, pero cada actualización pesa. Si crece, mover a releases.
