# Auditoría de fuentes — Observatorio Nacional del Bullying en el Perú

Fecha: **25 de septiembre de 2026** · Unidad de análisis objetivo: **servicio educativo (código modular) × año**

> Adaptado, con atribución y mejoras, de `docs/AUDITORIA-FUENTES.md` del
> [Observatorio de Violencia Escolar](https://github.com/fiorellatl/observatorio-violencia-escolar)
> (auditoría del 19-09-2026, sin licencia explícita: se reescribe, no se copia).
> Lo que **nosotros** verificamos con peticiones propias está marcado ✅; lo que
> tomamos de su auditoría sin repetir la prueba está marcado 🔁. Nada está inventado.

---

## 0. Advertencia previa: datos personales

La base entregada por Transparencia en 2026 (fuente **S2**) **no es agregada**: cada
fila describe un reporte con edad, sexo, grado, turno e idioma del estudiante
agredido y sexo/edad/relación del presunto agresor, más nombre y dirección del
colegio y fecha. Combinados, identifican a menores concretos aunque no haya nombres.

Diferencia clave con el proyecto de origen: **este observatorio nunca ha tenido el
archivo crudo**. Ingerimos únicamente la capa pública agregada (`data/public/` de su
repo: colegio × año × tipo), vendorada en `data/raw/observatorio-escolar/`. Por
tanto, en este repositorio **no existe ningún dato personal** y no hay nada que
anonimizar. Reglas que igualmente imponemos:

1. Ningún archivo caso-por-caso entra jamás al repositorio ni al sitio.
2. La web solo lee `data/processed/`, que es agregado.
3. Si algún día obtenemos la base por Transparencia (ver `SOLICITUD-TRANSPARENCIA.md`),
   la pediremos **sin** columnas del agredido ni del agresor, y el archivo vivirá
   fuera del repo (`data/raw/` está en `.gitignore`).
4. Supresión de celdas < 5 en cualquier corte que combine violencia sexual con nivel,
   grado o edad (hoy no publicamos ninguno de esos cortes).

---

## 1. Mapa de datos

| Variable | Fuente | Años | Granularidad | Llave | Acceso | Nivel |
|---|---|---|---|---|---|---|
| Reportes SíseVe (agregado colegio×año×tipo) | S2 vía capa pública de fiorellatl | 2013–ago 2026 | código modular | `cm` | JSON en GitHub | **A** ✅ |
| Reportes SíseVe nacionales y mensuales | S1 portal SíseVe (tablero) | 2024–2026 | nacional/UGEL | — | Chart.js del portal | **A** ✅ |
| Serie 2013–2022 (boletín) | Boletín "SíseVe en cifras" | 2013–2022 | nacional/depto | — | PDF repositorio MINEDU | **A** ✅ |
| Matrícula por departamento | INEI (cd1_81.xlsx) | 2024 | departamento | nombre | XLSX | **A** ✅ |
| Matrícula por colegio (denominador de tasas por región/UGEL) | S3 ESCALE Padrón/Censo 2024 | 2024 | código modular | `codMod` | vía `territorio.json` de fiorellatl | **A** 🔁 |
| Exposición medida (encuestas) | ENARES 2019, SSES 2023 | 2019/2023 | nacional | — | PDF | **A** ✅ |
| Colegios/agrupaciones Región Lima 2022–2026 | SíseVe/DRELM vía prensa | 2022–2026 | agrupación | nombre | prensa (ATV, ECData, La República) | **B** ✅ |
| Geometría departamental/distrital | juaneladio/peru-geojson | — | depto/distrito | `NOMBDEP`/`IDDIST` | GeoJSON (MPL-2.0) | — ✅ |
| Fecha de atención / cierre | — | — | — | — | **NO EXISTE en lo entregado** | 🔴 |

Niveles: **A** oficial/primaria · **B** prensa citando fuente oficial · **C** estimación
propia declarada · **D** no verificable. Ver `METHODOLOGY.md`.

---

## 2. Fuentes verificadas

### S1 — Portal público SíseVe ✅
`https://siseve.minedu.gob.pe/Web/App/Mapa`

- Endpoints `POST /TableroControl/Listar*` con cuerpo `{"filter": "<AES>"}`; la clave
  viaja en el HTML (ofuscación de cliente, no autenticación). **No los desciframos**:
  leemos lo que el portal ya dibuja (`window.Chart.instances`) con navegador headless,
  una lectura por página (`scripts/scrape_siseve.py`).
- 🔁 fiorellatl verificó que **no existe granularidad por IE** en el portal: los
  endpoints ignoran `CODIGO_MODULAR` y similares; el Excel público llega hasta UGEL.
  Coincide con nuestra búsqueda previa (`DATA_GAPS.md`: "el dashboard corta en UGEL").
- Años publicados: 2024, 2025, 2026. Rol: **validación cruzada**.

### S2 — Base SíseVe por Transparencia ⭐ fuente primaria (indirecta) 🔁
Archivo `AnexoMPD2026EXT0825304.xlsx`, hoja `ReporteCasos`, entregado por el MINEDU
al equipo del Observatorio de Violencia Escolar vía solicitud de acceso a la
información pública (Ley 27806). **122,984 reportes · 2013-01 → 2026-08-31 · 22,569
códigos modulares · 27 columnas** (incluye campos personales que no nos llegan).

Validación que ellos reportan contra S1 (coincidencia exacta): 2024 = 19,297; 2025 =
19,531; 2026 = 11,791; 2025 física/psicológica/sexual = 8,457 / 7,608 / 3,466; UGEL 07
San Borja 2025 = 1,266.

**Nuestra verificación independiente ✅** (`scripts/integrar_siseve_microdato.py`):
- Totales 2024, 2025 y 2026 idénticos a los que nosotros leímos del tablero oficial
  el 19-09-2026 (suma mensual = 19,297 / 19,531 / 11,791).
- `física + psicológica + sexual = total` y `entre escolares + personal IE = total`
  en los 14 años (aserción del script).
- `Σ t` del índice de colegios = 122,984 y `Σ y = t` en los 22,569 colegios
  (`scripts/build_schools_v2.py`).
- Cambios respecto a nuestra serie anterior (boletín/prensa): 2017 5,553→5,552;
  2018 9,384→9,383; 2019 13,006→13,001; 2020 756→755; 2022 12,099→12,025;
  2023 19,762 (prensa)→19,722. Diferencias ≤ 0.6 %; adoptamos el microdato por
  consistencia interna.

Serie anual (microdato):

| 2013 | 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 207 | 2,029 | 3,635 | 5,288 | 5,552 | 9,383 | 13,001 | 755 | 768 | 12,025 | **19,722** | 19,297 | 19,531 | 11,791 |

\* enero–agosto. 2020–2021 = cierre de colegios; no comparables. Pico real: 2023.

**Cadena de custodia hasta nosotros:** MINEDU → XLSX (Transparencia) → ETL y
anonimización de fiorellatl (`scripts/build_public_data.py`) → `data/public/*.json`
en GitHub (commit del 19–24-09-2026) → `data/raw/observatorio-escolar/` (vendorado)
→ `scripts/integrar_siseve_microdato.py`, `build_schools_v2.py`, `build_by_district.py`
→ `data/processed/`. Cada eslabón es reproducible salvo el primero.

### S3 — ESCALE, Padrón de IIEE + Censo Educativo 2024 🔁
`https://escale.minedu.gob.pe/padron/rest/` (API REST pública, sin autenticación).
Da identidad, coordenadas, nivel y, con `campos=estadistica`, matrícula y docentes de
**un solo año** (el vigente). Es el denominador de las tasas por región/UGEL que
tomamos de `territorio.json` (matrícula ≥ 100, cobertura declarada por región).
Nosotros seguimos usando **INEI 2024 por departamento** para la tasa del mapa; ambos
denominadores conviven y se declaran en la UI.

### S4 — Matriculación y Trayectoria 2021–2024 (Datos Abiertos) 🔁 · no integrada
CSV por año con `cod_mod`; aporta `Retirado` (deserción por colegio). Candidata a
integrar (ver §7).

### S5 — Identicole 🔁 · no integrada
Ficha por colegio renderizada en servidor (`/colegio/mi_colegio/{cod_mod}{anexo}`):
pensión 2024–2025 (declarativa), área, JEC, infraestructura (Censo 2021), ECE 2018.
No la usamos: **decidimos no cruzar pensión con violencia** en la portada por el
riesgo de lectura causal; queda como análisis futuro con confusores declarados.

### S6 — Deserción por distrito (Datos Abiertos) 🔁 · no integrada
Granularidad distrital; inferior a S4.

### Fuentes buscadas y NO encontradas ✅
- **SíseVe en datosabiertos.gob.pe**: no existe dataset (verificado por ambos equipos).
- **El XLSX `AnexoMPD2026EXT0825304.xlsx` en la web abierta**: no aparece (búsqueda
  web y búsqueda de código en GitHub, 25-09-2026). Su propio `PIPELINE.md` indica
  que el archivo "ya no está en disco". La vía es administrativa: presentar nuestra
  solicitud (`SOLICITUD-TRANSPARENCIA.md`).
- **Precedente ECData (El Comercio, 2023)**: base por IE entregada por Transparencia y
  publicada como investigación periodística; no localizamos un archivo descargable.

---

## 3. Llaves de unión

```
codinst (institución) 1 ─┬─ n codlocal (local físico)
                         └─ n codMod + anexo (servicio educativo = un nivel)
```

- Nuestra unidad publicada es el **servicio educativo (`cm`)**: por eso un colegio
  con primaria y secundaria aparece dos veces (p. ej. "Davy", Cajamarca). Mostramos
  siempre el **nivel** junto al nombre. Ver `MODELO-INSTITUCIONAL.md`.
- Región: normalización NFD sin diacríticos; "Lima" del microdato = Lima
  Metropolitana + Región Lima; "Callao" ↔ "Prov. Const. del Callao" (INEI).
- Distrito: unión por **ubigeo** (IDDIST del GeoJSON) y, si falla, por
  `DEP|PROV|DIST` normalizado; alias verificados (Pueblo Libre→Magdalena Vieja,
  Nasca→Nazca, Iscos→Yscos, Alomía Robles→Alomias). 98.97 % de los reportes con
  polígono; 53 distritos creados después de ~2015 y 8 sin geometría quedan
  "sin dato" (`data/geo/README.md`).

---

## 4. Cobertura temporal y comparabilidad

| Dataset | 2013–19 | 2020–21 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|
| S2 microdato (nacional, colegio, distrito) | ✅ | ✅ (no comparable) | ✅ | ✅ | ✅ | ✅ | ✅ ene–ago |
| S1 tablero (mensual) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Tasas por región (denominador Censo 2024) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Tasa nacional (INEI 2024) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅* | ❌ |

\* numerador 2025 sobre matrícula 2024 (declarado en la UI).
Solo **2023, 2024 y 2025** son años lectivos plenos y comparables entre sí.
**2024 es la ventana transversal** (única con reportes + denominador por colegio).

---

## 5. Calidad por fuente

| Fuente | Cobertura | Riesgos | Veredicto |
|---|---|---|---|
| S2 vía capa pública | 2013–2026, nacional, 22,569 IIEE | corte único 31-08-2026; sin `anexo` (ambigüedad en códigos con varios servicios); un reporte ≠ un caso | 🟢 A |
| S1 tablero | 2024–2026 | solo agregados; lectura headless frágil ante cambios del portal | 🟢 validación |
| Boletín 2013–2022 | nacional/depto | pequeñas diferencias vs microdato (≤ 0.6 %) | 🟢 A (histórico) |
| INEI matrícula | 2024, departamental | un solo año | 🟢 A |
| Prensa (Lima 2022–2026 por agrupación) | parcial | agrupaciones por cadena, no por código modular | 🟡 B |

---

## 6. Confusores que toda lectura debe declarar

- **Propensión a reportar**: más reportes suele significar que el canal funciona.
  🔁 fiorellatl reporta r = −0.54 entre log-volumen y % de agresor-personal-IE por DRE.
- **Tamaño del colegio** (correlaciona con conteo bruto). Por eso ofrecemos tasas
  donde hay denominador y sparkline por año en lugar de un solo número.
- **Nivel educativo**: secundaria concentra la mayoría de reportes.
- **Correlación física↔psicológica por colegio es muy débil** (r 0.03–0.18, verificado ✅
  en `correlation.json`): no hay un "perfil de colegio violento" único.
- Ninguna asociación admite lectura causal: "se asocia con", nunca "provoca".

---

## 7. Datos que faltan y próximos pasos

| Falta | Estado | Vía |
|---|---|---|
| Base caso-por-caso propia (sin datos personales) | 🔴 | `SOLICITUD-TRANSPARENCIA.md` (Mesa de Partes Virtual MINEDU) |
| Fechas de atención y cierre | 🔴 no existe en lo entregado en 2026 | pedirlas expresamente en la solicitud |
| `anexo` del servicio | 🔴 | pedirlo en la solicitud |
| Matrícula histórica por colegio | 🟡 | S4 Trayectoria 2021–2024 (CSV directo) |
| Deserción por colegio (`Retirado`) | 🟡 | S4 |
| Actualización periódica del microdato | 🔴 | pedir entrega trimestral o publicación en Datos Abiertos |
| Colegios de otras regiones por **agrupación/cadena** | 🟡 | el índice ya cubre todo el país por código modular |

---

## Reglas de extracción (vigentes)

- Orden de descubrimiento: API oficial → dataset descargable → endpoint público →
  HTML → scraping con navegador real, 1 lectura/página, cache en disco.
- **No se evade login, captcha ni control de acceso** y **no se descifra** el AES
  del portal: leemos solo lo que el portal muestra. El área autenticada de SíseVe y
  SIAGIE queda fuera; el camino a los datos por colegio es administrativo.
- Toda cifra publicada tiene fuente con URL y nivel A/B/C/D en `sources.json`.
