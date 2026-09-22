# ROADMAP, BACKLOG & MEJORAS — Observatorio Nacional del Bullying

Última actualización: 2026-09-22 · Estado: **v2 en producción** en
https://unimauro.github.io/bullying-peru/ · Repo: github.com/unimauro/bullying-peru

Validado en cada cambio con Playwright headless (desktop + móvil, 0 errores de consola).

---

## ✅ Lo que YA está hecho

### Datos (fuente A oficial salvo lo marcado)
- **Serie SíseVe 2013–2026**: 2013–2022 Boletín "SíseVe en cifras" (oficial); **2024–2026 del
  tablero oficial SíseVe** (leído de los gráficos Chart.js que el portal muestra); solo **2023**
  es prensa (sombreado). Bullying y ciberbullying por año (2013–2022).
- **Mensual/estacionalidad** 2024/2025/2026 (tablero oficial; sumas verifican).
- **26 departamentos 2022** (oficial, completo) + 2024/2026 (prensa, parcial).
- **Matrícula INEI 2024** (denominador de tasas).
- **ENARES 2019** y **SSES 2023** (exposición medida).
- **Perfil**: tipología/nivel/gestión/área (2022) + **crecimiento por tipo 2026** (sexual +35.4%).
- **En el mundo**: 25 países PISA 2018 + contexto global + noticias internacionales.
- **Colegios (Región Lima)**: 20 colegios/agrupaciones 2022–ago 2026 con reportes por año,
  sedes, total y **casos/sede** (SíseVe/DRELM vía transparencia; difundido por ATV/El Comercio/
  La República). Tabla ordenable por total o por sede.
- **Libros** (10 + 3 recursos), **normativa**, **noticias** (con auto-update diario filtrado).

### Producto / UX
- **Sidebar** dashboard (drawer en móvil), tema **claro cálido peruano**, responsive sin overflow.
- **Hero** con arte SVG + **rail de noticias vertical animado** (fotos reales og:image).
- **Mapa** coroplético multicolor (cuantiles) con leyenda de rangos; GeoJSON vendorizado local.
- **Barra de ayuda** superior (SíseVe, Línea 100, Chat 100, Denunciar).
- **"Para las familias"** (señales, pasos, canales oficiales verificados).
- **Chatbot IA "Pregúntale al Observatorio"** en producción vía gateway ai.tunky.net
  (token público acotado por Origin), con guardarraíles + citación + fallback local.
- **Yape/Plin 940584307 + PayPal** en el footer.
- **Google Analytics** (G-YD3GKLZX0T), **favicon + Open Graph** (imagen 1200×630).
- Gráficos ECharts estilizados (degradados, descarga PNG).

### Rigor / seguridad / accesibilidad
- Revisión **adversarial** (15 hallazgos) resuelta.
- **Seguridad**: escape XSS de todo texto de JSON + validación de imágenes/URLs (crítico por el
  cron que auto-publica noticias externas).
- **A11y**: contraste ~AA, `:focus-visible`, `aria-hidden` en iconos, `aria-pressed` en toggles.
- Distinción **bullying / ciberbullying / violencia escolar** y **registro (SíseVe) ≠ exposición
  (encuestas)** en todo el sitio. Nada de rankings de "peores".

### Infra
- **Cron diario** (GitHub Actions `update-news.yml` + `scripts/update_news.py`): Google News RSS,
  **filtrado por medios confiables**, con auto-commit. Funcionando.
- Docs: SOURCE_CATALOG, METHODOLOGY, DATA_DICTIONARY, DATA_GAPS, ARCHITECTURE, este ROADMAP.
- Scrapers documentados: `scrape_siseve.py` (método legítimo: leer los gráficos Chart.js del
  tablero; NO descifrar AES ni resolver CAPTCHA; con moderación).

---

## 🔜 BACKLOG (prioridad)

| # | Prioridad | Ítem |
|---|---|---|
| B1 | **P0** | **Pedido de transparencia (Ley 27806) a MINEDU** por reportes SíseVe por institución educativa 2022–2026 de TODAS las regiones (no solo Lima) → dato oficial completo por colegio. Redactar carta, presentar en Mesa de Partes Virtual, cargar el Excel al llegar. |
| B2 | P1 | Confirmar 2023 (único año de prensa) con el tablero/boletín oficial. |
| B3 | P1 | Scrapear del tablero (método legítimo, con moderación) **tipología/nivel/gestión/género por AÑO** (2024–2026) para actualizar el Perfil más allá del boletín 2022. |
| B4 | P1 | **UGEL con cifras reales** (Lima Cercado, San Borja, Rímac…): el drill Región→UGEL necesita interacción del mapa; automatizar con Playwright. |
| B5 | P2 | Colegios de **otras regiones** (cuando llegue B1) + buscador por nombre de colegio. |
| B6 | P2 | Drill-down del mapa Departamento → Provincia/Distrito (si aparece el dato). |
| B7 | P2 | Perfil de víctimas/agresores (sexo, nivel) y urbano/rural con tasas, si hay dato por año. |
| B8 | P3 | Exportación PNG/PDF por sección + "descargar dataset de esta vista". |
| B9 | P3 | `data_quality_report.html` + tests de esquema JSON en CI. |
| B10 | P3 | Ampliar la allowlist de medios del cron si se desea (Willax, apnoticias, etc.). |

---

## 💡 MEJORAS / ideas futuras
- **PWA** (instalable, offline) para familias.
- **Comparador** de dos regiones/colegios lado a lado.
- **"Hallazgos automáticos"** en texto descriptivo (sin causalidad) a partir de los datos.
- Página `/metodologia` y `/fuentes` dedicadas (hoy son secciones).
- Traducción a **quechua/aymara** de la sección "Para las familias".
- **Alertas** de nuevos casos relevantes (opt-in) o boletín.
- Índice de **calidad/cobertura de reporte por región** (para reforzar "más reportes ≠ más violencia").
- Miniaturas reales para TODAS las noticias del cron (hoy og:image best-effort).

---

## ⚠️ Límites conocidos (no son pendientes, son la realidad del dato)
- SíseVe **público llega hasta UGEL**; el dato por colegio solo por transparencia.
- **API abierta oficial**: no existe (endpoints cifrados AES + reCAPTCHA v3). No se descifra.
- **Datos mensuales** oficiales: solo desde el tablero (ya incorporados 2024–2026).
- **Teléfono gratuito de SíseVe**: NO publicado (fuentes en conflicto: 0800 77090 vs 76 888).
- SíseVe registra **reportes de presuntos hechos**, no la prevalencia real.
