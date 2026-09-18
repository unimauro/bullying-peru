# ROADMAP & BACKLOG — Observatorio Nacional del Bullying

Última revisión: 2026-09-18 · Estado: **v1.0 desplegado y funcional** en
https://unimauro.github.io/bullying-peru/

Validado headless (Playwright): 5/5 gráficos pintados, mapa con 28 polígonos y tiles,
0 errores de consola.

---

## Dónde estamos (v1.0)

✅ Fase 1 (investigación de fuentes) completa · ✅ Dashboard estático · ✅ Mapa · ✅ Serie
histórica · ✅ Territorio (absoluto vs tasa) · ✅ Prevalencia (ENARES + SSES) · ✅ Comparación
de fuentes · ✅ Investigación académica · ✅ Noticias · ✅ Políticas · ✅ Explorador + CSV ·
✅ Metodología/Fuentes/Limitaciones · ✅ Chatbot (gateway + fallback local).

**Límite de datos reconocido:** SíseVe no tiene API abierta; las cifras 2019–2025 son de
prensa (nivel B) y el desglose departamental es parcial. La vía para subir a fuente A (exacta)
es el scraper headless de `/Web/App/MapaDetalle` (ya escrito, sin ejecutar).

---

## Roadmap por fases

### Fase 2 — Datos de fuente A (rigor máximo)  ·  prioridad ALTA
- [ ] Ejecutar `scripts/scrape_siseve.py --harvest` (Playwright) 2013→2026 × 26 regiones.
- [ ] `clean_data.py`: parsear el HTML cosechado → reemplazar cifras B por A en
      `timeseries.json` y `by_department.json`, con `reliability: "A"`.
- [ ] Completar los 26 departamentos por año (hoy el mapa tiene cobertura parcial).
- [ ] Serie de **ciberbullying** ("por Internet") por año, si el detalle la expone.
- [ ] Desglose **departamento × tipo de violencia** (física/psicológica/sexual/…).
- [ ] Cifras oficiales 2020/2021 (hoy `null`) si el portal las devuelve.

### Fase 3 — Profundidad analítica  ·  prioridad MEDIA
- [ ] **Índice de calidad/cobertura por región** (IIEE afiliadas, propensión a reportar) —
      para advertir que más reportes ≠ más bullying.
- [ ] Drill-down **Departamento → Provincia → Distrito** (si MapaDetalle lo permite).
- [ ] **Análisis temporal mensual** y estacionalidad (meses con más reportes).
- [ ] **Perfil de víctimas** (sexo, nivel, área, gestión) y **de agresores** (solo variables con dato).
- [ ] **Urbano vs rural** y **público vs privado** con tasas normalizadas.
- [ ] Sección **"Hallazgos automáticos"** (texto descriptivo, sin causalidad).
- [ ] **Detección de cambios/anomalías** con "posibles explicaciones" (nunca hipótesis como hecho).

### Fase 4 — Producto y experiencia  ·  prioridad MEDIA
- [ ] **Chatbot IA en producción**: token del gateway `ai.tunky.net` (pedir a Carlos) en
      `src/js/config.js`; verificar allowlist de Origin `unimauro.github.io`.
- [ ] Páginas dedicadas `/metodologia` y `/fuentes` (hoy son secciones).
- [ ] **Exportación por visualización**: PNG (toolbox de ECharts) y PDF; "descargar dataset".
- [ ] **Accesibilidad WCAG**: contraste AA, navegación por teclado, `aria-label`, no depender
      solo del color, foco visible.
- [ ] Toggle de tema claro/oscuro manual (hoy sigue el sistema).
- [ ] Meta/OG tags + favicon + og:image para compartir.

### Fase 5 — Automatización y confianza  ·  prioridad BAJA
- [ ] **GitHub Actions**: refresco periódico de noticias y datos; `last_updated_at` por fuente.
- [ ] `data_quality.py` → `data_quality_report.html` (negativos, duplicados, %>100, totales≠subtotales).
- [ ] Tests (validación de esquema de cada JSON, rangos, UBIGEO válidos).
- [ ] Documentar cómo reproducir todo el pipeline (README "¿Cómo construimos estos datos?").

---

## Backlog priorizado

| # | Prioridad | Tipo | Ítem |
|---|---|---|---|
| B1 | **P0** | bug/UX | KPI de **bullying** desaparece si el último año (2026) no tiene valor; mostrar el último dato disponible con su año (2022: 2,498). |
| B2 | **P0** | datos | Correr scraper SíseVe → subir 2019–2025 de nivel B a **A**. |
| B3 | P1 | UX/mapa | Lima: el polígono usa solo "Lima Metropolitana"; unir con "Región Lima" o mostrar ambos en el tooltip. |
| B4 | P1 | feature | Índice de calidad/cobertura por región. |
| B5 | P1 | feature | Export PNG/PDF por gráfico + "descargar dataset de esta vista". |
| B6 | P1 | producto | Token del chatbot en producción. |
| B7 | P2 | a11y | Auditoría WCAG y correcciones. |
| B8 | P2 | feature | Drill-down provincia/distrito. |
| B9 | P2 | feature | Serie mensual y estacionalidad. |
| B10 | P2 | infra | GitHub Actions de actualización + data_quality_report. |

## Quick wins (bajo esfuerzo, alto impacto)
- B1 (KPI bullying con último dato) · B3 (tooltip Lima) · favicon + OG tags · toolbox de
  export PNG en ECharts (una línea por gráfico).
