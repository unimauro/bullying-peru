# CATÁLOGO DE FUENTES

Fecha de consulta: 2026-09-18 · Estado: **Fase 1 completada** (con vacíos documentados en [`DATA_GAPS.md`](DATA_GAPS.md))

Clasificación de confiabilidad: **A** oficial primaria · **B** internacional/académica · **C** periodística verificable · **D** secundaria (ver [METHODOLOGY §7](METHODOLOGY.md)).

## Fuentes oficiales primarias (A)

| Fuente | Institución | URL | Tipo | Período | Variables | Acceso | Calidad |
|---|---|---|---|---|---|---|---|
| **SíseVe** (portal) | MINEDU | https://siseve.minedu.gob.pe/web/ | Registro administrativo | 2013–actual | tipo de violencia, sexo, nivel, gestión, área, región, estado | HTML server-side (reCAPTCHA); scraping vía `/Web/App/MapaDetalle?filter=base64` | A |
| **Informe SíseVe 2013-2018** | MINEDU | https://repositorio.minedu.gob.pe/handle/20.500.12799/6670 | Informe | 2013–2018 | breakdowns completos | PDF (descargado) | A |
| **Boletín 'SíseVe en cifras'** | MINEDU | https://repositorio.minedu.gob.pe/handle/20.500.12799/9786 | Boletín | hasta 2022/2023 | conteos por tipo/año | PDF | A |
| **SSES 2023** (habilidades socioemocionales) | UMC/MINEDU + OCDE | https://repositorio.minedu.gob.pe/handle/20.500.12799/10772 | Encuesta (exposición) | 2023 | roles víctima/agresor, tipos, estratos | PDF (descargado) | A |
| **Matrícula por departamento 2009-2024** | INEI (MINEDU-Censo Educativo) | https://www.inei.gob.pe/media/MenuRecursivo/indices_tematicos/cd1_81.xlsx | Registro | 2009–2024 | matrícula por depto | **XLSX directo** (descargado) | A |
| **ENARES 2019** | INEI | https://www.inei.gob.pe/media/MenuRecursivo/boletines/presentacion_enares_2019.pdf | Encuesta (prevalencia) | 2013/2015/2019 | % violencia en entorno escolar por edad | PDF | A |
| **Supervisión convivencia escolar 2019** | Defensoría del Pueblo | https://www.defensoria.gob.pe/wp-content/uploads/2020/01/Informe-de-adjunt%C3%ADa-CE-2019-ADM.pdf | Supervisión | 2018–2019 | cumplimiento normativo IIEE | PDF | A |
| **Atenciones salud mental NNA** | MINSA | https://www.gob.pe/institucion/minsa/noticias/1037025-mas-de-1-300-000-casos-atendidos-por-trastornos-de-salud-mental-y-problemas-psicosociales | Registro (contexto) | 2023–actual | atenciones (contextual, no causal) | HTML | A |

## Fuentes internacionales / académicas (B)

| Fuente | Institución | URL | Período | Calidad |
|---|---|---|---|---|
| Behind the numbers: ending school violence and bullying | UNESCO | https://www.unesco.org/en/articles/behind-numbers-ending-school-violence-and-bullying | 2019 | B |
| Cifras de la violencia hacia NNA en el Perú | UNICEF Perú | https://www.unicef.org/peru/sites/unicef.org.peru/files/2019-09/cifras-violencia-ninas-ninos-adolescentes-peru-2019.pdf | 2019 | B |
| 5 estudios académicos (Valle 2022, Lazo-Legrand 2022, Padilla Lay 2025, Zegarra-Chapoñan 2023, cyberbullying UNMSM) | varias | ver `data/processed/studies.json` | 2012–2025 | B |

## Fuentes periodísticas (C) — solo para contexto/casos, nunca como estadística primaria

Ver `data/news/news.json`. Las cifras SíseVe 2019–2025 que circulan en prensa (13,007 / 12,083 / 19,762 / 19,684 / ~19,666) están marcadas **B** y **pendientes de re-verificación** contra el scraping oficial de MapaDetalle.

## Método de obtención SíseVe (reproducibilidad)

- No hay API pública JSON/CSV. La app es ASP.NET MVC con reCAPTCHA Enterprise.
- Dashboard nacional: `https://siseve.minedu.gob.pe/Web/App/Mapa` (HTTP 200).
- Detalle: `https://siseve.minedu.gob.pe/Web/App/MapaDetalle?filter=<base64url(JSON)>`
  con `{"isnational":false,"departamento":"Arequipa","reportDate":"2025","ubigeoCode":"PE.AR"}`.
- Cosecha: recorrer `reportDate` 2013→2026 × 26 `ubigeoCode` con navegador headless (curl da 403 en los JS internos). Ver `scripts/scrape_siseve.py`.

## GeoJSON

- `https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson`
  — 25 rasgos, UBIGEO en `FIRST_IDDP`, nombre en `NOMBDEP`, WGS84, CORS abierto, licencia MPL-2.0.
