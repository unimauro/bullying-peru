# METODOLOGÍA

Fecha de última revisión: 2026-09-18

Este documento define **qué mide el observatorio, cómo trata los datos y cuáles son sus
límites**. Es la referencia para toda cifra publicada.

## 1. Definiciones (no son intercambiables)

Este es el punto más crítico del proyecto. Se usan tres conceptos distintos y **nunca**
como sinónimos:

| Concepto | Definición operativa | Rasgos distintivos |
|---|---|---|
| **Bullying / acoso escolar** | Agresión **entre estudiantes** con **intencionalidad**, **repetición/persistencia** y **desequilibrio de poder**. | Requiere los tres rasgos. Un episodio aislado no es bullying. |
| **Ciberbullying** | Acoso ejercido mediante internet, redes sociales, mensajería o dispositivos digitales. | Subtipo digital del acoso. |
| **Violencia escolar** | Categoría **más amplia**: incluye violencia física, psicológica, sexual, el bullying, el ciberbullying y la violencia de **personal educativo hacia estudiantes**. | No toda violencia escolar es bullying. |

Cada gráfico indica **cuál de los tres** está midiendo. Cuando una fuente usa su propia
clasificación, se respeta **exactamente** y se cita.

## 2. Registro administrativo ≠ exposición medida

Se distinguen dos naturalezas de dato que **no se concatenan ni se comparan directamente**:

- **Registro administrativo (SíseVe):** número de **reportes de presuntos hechos**
  ingresados al sistema. Depende de la propensión a reportar y de la cobertura del sistema.
  **No es** la prevalencia real del bullying en la población escolar.
- **Exposición medida (encuestas a estudiantes, p. ej. SSES/evaluaciones muestrales
  MINEDU, ENARES-INEI):** porcentaje de estudiantes que **declara** haber sufrido acoso,
  estimado sobre una muestra representativa.

Un aumento de reportes puede reflejar más casos, **o** mayor cultura de reporte, **o**
cambios del sistema. Los datos no permiten, por sí solos, atribuir causalidad.

## 3. Reglas duras de tratamiento de datos

1. **No inventar datos.** Sin fuente con URL, no entra.
2. **No interpolar/estimar** sin marcarlo explícitamente como `estimado`.
3. **No mezclar** "violencia escolar" con "bullying".
4. **No concatenar series** de años con metodología/categorización distinta sin verificar
   comparabilidad (ver §5).
5. **Casos absolutos ≠ tasa.** Una región con más estudiantes tiende a más reportes. Se
   publican por separado "mayor número de reportes" y "mayor tasa por 10,000 estudiantes".
6. **No causalidad** entre bullying y salud mental por simple correlación; esos indicadores
   se presentan como **contextuales**.
7. **Sin datos personales de menores** (nombres, DNI, dirección, teléfono). Solo agregados.
8. **Ranking descriptivo**, nunca "mejores/peores" regiones.

## 4. Indicadores (KPIs)

| KPI | Fórmula | Nota |
|---|---|---|
| Casos de bullying reportados | conteo SíseVe (categoría bullying) | reportes, no prevalencia |
| Casos de ciberbullying | conteo SíseVe (categoría digital) | |
| Total violencia escolar | conteo SíseVe (todas las categorías) | |
| Variación interanual | (año_t − año_{t-1}) / año_{t-1} | solo entre años comparables |
| Tasa por 10,000 estudiantes | casos / matrícula × 10 000 | requiere matrícula por depto |
| % bullying / violencia escolar | bullying / total × 100 | |
| % ciberbullying / bullying | ciber / bullying × 100 | |

## 5. Comparabilidad temporal y COVID-19

- Se anotan en las series los **cambios metodológicos**, de cobertura o del sistema SíseVe.
- **2020–2021 (pandemia):** una caída de reportes **no** se interpreta como reducción real
  del bullying; la no presencialidad alteró la exposición y los mecanismos de reporte.
- Períodos: **2013–2019** (pre), **2020–2021** (pandemia), **2022–actual** (post).
- **Año en curso parcial:** un año incompleto se rotula "datos parciales (meses X–Y)" y no
  se compara con años completos sin advertencia.

## 6. Calidad y cobertura por región

Se calcula un **índice de calidad/cobertura de datos** por departamento para advertir que
más reportes no implican más bullying: pueden reflejar mayor población escolar, mayor
cobertura del sistema o mayor propensión a reportar.

## 7. Clasificación de confiabilidad de fuentes

- **A** — fuente oficial primaria (MINEDU/SíseVe, INEI, Defensoría, MINSA).
- **B** — organismo internacional / investigación académica (UNICEF, UNESCO, papers).
- **C** — periodística con dato verificable a fuente primaria.
- **D** — secundaria. **Nunca** como evidencia principal.

## 8. Niveles de verificación de casos (noticias)

`REPORTADO` · `INVESTIGACIÓN PERIODÍSTICA` · `CONFIRMADO POR FUENTE OFICIAL` · `NO VERIFICADO`.
Un caso "reportado" nunca se presenta como "confirmado".

## Control de divulgación estadística por colegio (desde 25-09-2026)

Publicamos reportes por colegio (código modular) y año, pero **no** cifras que permitan
reidentificar a una víctima o a un docente en colegios pequeños:

1. `sexual` y `personal de la IE` por colegio-año con valor **1–4 se publican como "<5"**
   (`-1` en los JSON/CSV). Los totales anuales no cambian.
2. En **Inicial** no se publica desglose por tipo (solo totales).
3. La misma regla rige la web, las descargas JSON/CSV y las fichas por institución.
4. Las sedes del mapa muestran nombre del colegio y totales, nunca tipo; sin enlace
   externo de geolocalización.
5. El chatbot no identifica personas, prioriza protocolos de crisis (113 op. 5, 100,
   Chat 100, 106, 105) y no produce rankings.

Base: Ley 29733 (datos sensibles), Ley 27337 CNA art. 6, Ley 27806 art. 17; revisión
adversarial de psicología/ética `docs/reviews/2026-09-25-psicologia-etica.md`.
