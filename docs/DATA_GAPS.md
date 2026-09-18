# VACÍOS DE DATOS (DATA GAPS)

Fecha: 2026-09-18 · Estado: **Fase 1 — en construcción**

Registro **explícito** de lo que no existe, no se encontró o no es comparable. Ser honesto
aquí es parte del rigor: el observatorio prefiere declarar un vacío antes que rellenarlo
con una estimación disfrazada de dato oficial.

## Datos buscados y no hallados (Fase 1)

- **API/endpoint JSON o CSV oficial de SíseVe:** NO EXISTE público. Solo HTML server-side con reCAPTCHA; requiere scraping con navegador headless de `/Web/App/MapaDetalle`.
- **Totales SíseVe de fuente A para 2019–2025:** NO confirmados por documento oficial; las cifras usadas provienen de prensa que cita a MINEDU (nivel B) y están marcadas como tales en `timeseries.json`. Pendiente: ejecutar el scraper por año.
- **Totales SíseVe 2020 y 2021:** NO CONFIRMADOS por ninguna fuente (educación remota). Se dejan como `null` (no se estiman).
- **Serie anual de ciberbullying ('violencia por Internet'):** NO EXISTE desagregada por año. Es uno de los 7 tipos, pero no se publica su serie temporal.
- **Cifra exacta de bullying 2013 (~53):** aproximada, NO confirmada en fuente A.
- **Desglose departamento × tipo de violencia:** NO publicado; requiere scraping de MapaDetalle.
- **Datos SíseVe por departamento completos (26 regiones):** solo se tiene el top publicado en prensa para 2026 (11 regiones) y 7 para 2024. El resto queda 'sin dato' en el mapa (no se rellena).
- **Matrícula por NIVEL (inicial/primaria/secundaria) por departamento:** NO hay descarga directa; solo el total por departamento (INEI XLSX). El desglose está en el módulo interactivo ESCALE Magnitudes.
- **ENARES / SSES por departamento:** NO se publican desagregados regionalmente (solo nacional / urbano-rural / estratos).
- **ENARES posterior a 2019 y SSES posterior a 2023:** NO publicados a la fecha de consulta.

## Limitaciones estructurales conocidas

- **Subregistro:** SíseVe depende del reporte ciudadano/institucional; no capta todos los
  hechos ocurridos.
- **Duplicidad potencial:** puede existir más de un reporte sobre un mismo caso.
- **Reportes ≠ prevalencia:** SíseVe mide casos reportados, no la prevalencia real en la
  población escolar.
- **Cambios metodológicos / de cobertura** a lo largo de los años (por confirmar cuáles).
- **Pandemia (2020–2021):** presencialidad y mecanismos de reporte alterados; series no
  directamente comparables.
- **Registro administrativo vs encuestas:** SíseVe y las evaluaciones de exposición
  (SSES/ENARES) miden cosas distintas y no se agregan.
- **Desglose sub-departamental:** provincia/distrito puede no estar disponible públicamente.
- **Matrícula por departamento y nivel:** necesaria para tasas; verificar disponibilidad y
  año más reciente.

## Comparabilidad temporal

- Verificar si la serie 2013–2018 y la serie 2019–2023+ usan la **misma categorización**
  antes de graficarlas como una sola línea continua.
