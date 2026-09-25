# VACÍOS DE DATOS (DATA GAPS)

Fecha: 2026-09-18 · Estado: **Fase 1 — en construcción**

Registro **explícito** de lo que no existe, no se encontró o no es comparable. Ser honesto
aquí es parte del rigor: el observatorio prefiere declarar un vacío antes que rellenarlo
con una estimación disfrazada de dato oficial.

## Resuelto (actualizado 2026-09-24)

- ✅ **Serie completa 2013–2026 por MICRODATO OFICIAL SíseVe** (solicitud de acceso a la información pública): 2023–2026 dejan de ser prensa; toda la serie pasa a nivel **A**. Fuente vendorada en `data/raw/observatorio-escolar/` (consolidado de fiorellatl/observatorio-violencia-escolar) y transformada por `scripts/integrar_siseve_microdato.py`.
- ✅ **Composición por tipo por año** (física + psicológica + sexual = total; entre escolares + personal de la IE = total; bullying y ciberacoso como etiquetas transversales) — nueva sección.
- ✅ **Territorio 2024 oficial (25 regiones)** con tasa y serie por región (`territory.json`); mapa por defecto ahora en **2024**.
- ✅ **Correlación física↔psicológica por colegio, anonimizada** (`correlation.json`) — sin identificar colegios (registro ≠ exposición).
- ✅ **Colegios, sección integrada** (a pedido de las familias): top nacional por defecto (`schools_top.json`, 300 IIEE con serie 2013–2026 y tipos) + buscador y filtros por región/gestión/nivel/año sobre el índice completo (`schools_index.json`, 22,569 IIEE con `y[14]` por año, carga perezosa) + detalle por año y tipo al hacer clic (shards `schools_detail/<región>.json`). Generado por `scripts/build_schools_v2.py`. Cada nivel educativo es una IE distinta en el padrón (p. ej. "Davy" Primaria y Secundaria aparecen por separado). Aviso anti-sesgo destacado (reportes ≠ prevalencia; más reportes puede ser mejor cultura de denuncia; cero reportes puede ser ocultamiento). Outlier a tratar con cuidado en la narrativa: Davy Primaria (Cajamarca) concentra 396 reportes 2022–2026.
- ✅ **Mapa por distritos** (`data/geo/peru-distrital.geojson`, `by_district.json`, `src/js/districts.js`): drill-down al hacer clic en una región y vista distrital nacional, agregando el microdato por distrito. Los distritos sin reportes quedan "sin dato" (no se estiman). Cobertura: 1,714 de 1,767 distritos del microdato cruzan con el GeoJSON (98.97 % de los reportes); 53 distritos creados después de ~2015 (p. ej. Veintiséis de Octubre, Mi Perú) y 8 sin geometría en el GeoJSON origen (p. ej. Santa Anita, Bellavista-Piura, La Punta) quedan "sin dato" aunque tengan reportes. Detalle en `data/geo/README.md` y en `coverage`/`sin_match` de `by_district.json`.
- ✅ **Colegios completos (instituciones)** y **mapa de sedes por distrito** (25-09-2026): `institutions_index.json` (17,185 instituciones por `codinst`, con niveles, matrícula 2024 y tasa por 1,000 solo si todos los niveles tienen matrícula) + `schools_geo.json` (coordenadas y `codlocal` desde la API pública del Padrón ESCALE, lista blanca sin datos personales). En "¿Y por colegio?": filtro por **distrito** con resumen, vista "Colegios completos" y mapa de **sedes físicas** (una burbuja por local, agrupando niveles) del distrito elegido; clic en un distrito del mapa del Perú salta a sus colegios. Pedido por Fernando (24-09-2026): "en San Isidro un mapa o resumen con los colegios y su ranking de denuncias" — resuelto con el marco anti-sesgo.
- ✅ **Costo (pensión) por distrito** (25-09-2026): `pension_distritos.json` (Identicole 2024–2025, declarativa; 1,854 servicios privados con dato; 38 distritos con n ≥ 5) + tramos nacionales de pensión vs reportes por 1,000 (2024). Se publica con marco explícito de confusores (capacidad de denunciar, cobertura UGEL, tamaño). La pensión también aparece en la vista de instituciones y en el detalle por servicio.
- ⚠️ **Sexo del presunto agresor: NO EXISTE en fuentes abiertas** (ni por región ni por colegio). El microdato de Transparencia sí lo registra (`SUPUESTO_AGRESOR_SEXO`, `AGREDIDO_SEXO`) pero son datos personales y no se publican caso a caso. Solo hay agregados nacionales del sexo de la **víctima** (Boletín 2022: mujer 52.5 % / varón 47.5 %; entre escolares 2013–2018: varón 57 % / mujer 43 %), ahora sí visibles en «Perfil de casos». La `SOLICITUD-TRANSPARENCIA.md` pide tablas agregadas por sexo del agredido y del presunto agresor.
- ✅ **Revisión adversarial psicología/ética aplicada (25-09-2026)**: protocolo de crisis y abuso en el chatbot (antes que cualquier otra regla), negativa explícita a identificar personas, sin rankings para periodistas; supresión "<5" de `sexual`/`personal_ie` por colegio-año y sin desglose en Inicial (42,536 celdas), en web y descargas; Línea 113 op. 5, escalamiento (UGEL/Defensoría/DEMUNA/105) y "qué no hacer" en Para las familias; pensión reescrita como descripción sin causa y sin columna "públicos". Pendientes de decisión del equipo: ranking por defecto vs búsqueda primero; "casos"→"reportes" en títulos; carrusel de titulares. Informe completo: `docs/reviews/2026-09-25-psicologia-etica.md`.
- ✅ **Revisión adversarial de seguridad aplicada (25-09-2026)**: la supresión "<5" es ahora **complementaria y jerárquica** (`scripts/privacy.py`; el revisor verificó 0 celdas recuperables por resta); CSP por `<meta>` (0 violaciones en headless), SRI en Leaflet/ECharts, Google Analytics con **Consent Mode** (denegado hasta aceptar, barra de consentimiento, sección Privacidad), chat con límite de 500 caracteres, bloqueo de envíos, sin volcado de JSON y aviso de servicio externo, `fmt()` a prueba de strings, CSV sin inyección de fórmulas, escapes en fuentes/cites, cron de noticias con allowlist **exacta por nombre y por dominio** (antes "Wikipedia" pasaba por contener "ipe"), TLS verificado y límites de imagen, actions fijadas por SHA. Gateway ai.tunky.net (25-09-2026, hecho): token dedicado vinculado al proyecto `bullying-peru`; modelo y system prompt fijados del lado servidor (el cliente no puede cambiarlos), cadena NVIDIA Nemotron 3 Ultra 550B → 3.5 Lightning → 3 Super 120B (nivel gratuito; puede retener datos: avisado en Privacidad), max_tokens 600, 20 req/min por IP, 300/día por IP, 2,000/día del proyecto. Pendiente: proteger la rama main en GitHub. Informe: `docs/reviews/2026-09-25-seguridad.md`.
- ✅ **Chatbot** actualizado: construye su contexto desde los JSON cargados (`window.OBS_DATA`), sin cifras a mano; sabe del buscador y NO inventa cifras por colegio.

## Resuelto (actualizado 2026-09-22)

- ✅ **Serie 2013–2022** de violencia, **bullying y ciberbullying** por año: OFICIAL (Boletín SíseVe).
- ✅ **2020 y 2021**: cifras oficiales (755 y 768) — caída por cierre de escuelas.
- ✅ **Bullying 2013 = 53**: confirmado oficialmente.
- ✅ **26 departamentos de 2022**: oficiales y completos (mapa por defecto en 2022).
- ✅ **2024 y 2025**: oficiales del **tablero SíseVe** (19,297 y 19,531), no prensa.
- ✅ **Datos MENSUALES 2024–2026**: del tablero oficial (sección estacionalidad).
- ✅ **Colegios de Región Lima** (20, 2022–2026): SíseVe/DRELM vía transparencia (prensa).
- ✅ **Crecimiento por tipo 2026** (sexual +35.4%, física +16.5%, psicológica +15.3%).

Pendiente principal (ver ROADMAP): colegios de **otras regiones** vía pedido de transparencia
Ley 27806 a MINEDU; confirmar 2023; tipología/nivel/género por año; UGEL con cifras.

## Datos buscados y no hallados

- **API/endpoint JSON o CSV oficial de SíseVe:** NO EXISTE público. El dashboard tiene endpoints internos **cifrados en AES** y devuelven 403 sin sesión de navegador; el Excel solo se baja manualmente desde la UI. datosabiertos.gob.pe NO tiene SíseVe.
- ~~**Totales SíseVe 2023–2026:** aún sin boletín oficial; cifras de prensa (nivel B).~~ **RESUELTO 2026-09-24**: microdato oficial 2013–2026 (acceso a la información pública) integrado; toda la serie es nivel A.
- **Datos por INSTITUCIÓN EDUCATIVA / colegio:** NO EXISTE dataset abierto (protección de datos; el dashboard corta en UGEL). No hay ranking oficial de colegios.
- **Datos MENSUALES:** NO EXISTE open dataset mensual.
- **Detalle por departamento 2024/2026:** solo el top publicado en prensa; el resto queda 'sin dato' (no se estima). El nivel UGEL 2024/2025 existe en el dashboard pero solo por descarga manual de Excel.
- **Matrícula por NIVEL por departamento:** solo total por departamento (INEI XLSX); el desglose está en ESCALE Magnitudes.
- **ENARES / SSES por departamento:** no se publican desagregados regionalmente.
- **ENARES posterior a 2019 y SSES posterior a 2023:** no publicados a la fecha de consulta.

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
