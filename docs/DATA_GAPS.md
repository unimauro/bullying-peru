# VACÍOS DE DATOS (DATA GAPS)

Fecha: 2026-09-18 · Estado: **Fase 1 — en construcción**

Registro **explícito** de lo que no existe, no se encontró o no es comparable. Ser honesto
aquí es parte del rigor: el observatorio prefiere declarar un vacío antes que rellenarlo
con una estimación disfrazada de dato oficial.

## Resuelto (actualizado 2026-09-22)

- ✅ **Serie 2013–2022** de violencia, **bullying y ciberbullying** por año: OFICIAL (Boletín SíseVe).
- ✅ **2020 y 2021**: cifras oficiales (756 y 768) — caída por cierre de escuelas.
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
- **Totales SíseVe 2023–2026:** aún sin boletín oficial; las cifras usadas son de prensa citando a MINEDU (nivel B), marcadas como tales en `timeseries.json`.
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
