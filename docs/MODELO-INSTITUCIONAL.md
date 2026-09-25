# Modelo institucional

Cómo este observatorio distingue un colegio de otro, qué unidad publica y qué
reglas aplica al agregar. Adaptado, con atribución y decisiones propias, de
`docs/MODELO-INSTITUCIONAL.md` del
[Observatorio de Violencia Escolar](https://github.com/fiorellatl/observatorio-violencia-escolar).

## Tres conceptos que no son lo mismo

| Concepto | Qué es | Clave oficial | ¿La tenemos? |
|---|---|---|---|
| **Institución educativa** | La organización («Colegio Pedro Ruiz Gallo») | `codinst` | ❌ no viene en la capa que ingerimos |
| **Servicio educativo** | Un nivel concreto: la primaria, la secundaria | `codMod` (+ `anexo`) | ✅ `cm` en `schools_index.json` (sin `anexo`) |
| **Local educativo** | El terreno y los edificios | `codlocal` | ❌ |

Una institución puede prestar varios servicios en un local; dos instituciones pueden
compartir local; un servicio pertenece a una sola institución. Mezclar los tres
produce números mal construidos (sumar reportes de una contra la matrícula de otra).

## La unidad que publicamos es el servicio educativo

SíseVe registra cada reporte contra un **código modular**, es decir contra un
servicio, no contra la institución. Consecuencias que aplicamos en la UI:

1. **Un colegio con inicial, primaria y secundaria aparece hasta tres veces** en el
   buscador y en el top. No es un duplicado. Ejemplo real: «Davy» (Cajamarca) figura
   como `1110972` Primaria (396 reportes) y `1111012` Secundaria (141).
2. Por eso **el nivel se muestra siempre junto al nombre**, y el código modular en la
   fila, para que el lector no lea dos servicios como «el mismo colegio repetido».
3. **No agrupamos por nombre** (hay cientos de «San Martín de Porres») ni por
   distrito. Sin `codinst` preferimos un colegio partido en niveles a una institución
   inventada.
4. Cuando el pedido de transparencia propio nos entregue `anexo` y podamos cruzar con
   el Padrón de ESCALE (`codinst`), se añadirá una vista «institución completa»
   siguiendo las reglas de agregación de abajo.

## Reglas de agregación (vigentes para región, distrito y futuro `codinst`)

| Variable | Regla | Por qué |
|---|---|---|
| Reportes | **Se suman** | Un reporte pertenece a un solo servicio |
| Matrícula | **Se suma** | Cada nivel atiende a una población distinta |
| Tasa | **Se recalcula** desde numerador y denominador sumados | Promediar tasas no corresponde a ninguna población real |
| Porcentajes | **Se recalculan** | Un porcentaje es un cociente |
| Etiquetas transversales (bullying, ciberacoso) | **Se suman, pero nunca contra el total** | Un mismo reporte puede ser física + bullying: no son partición |
| Contexto (gestión, nivel, área) | **No se agrega** | Son atributos del servicio |

**Regla del denominador completo**: una tasa se publica solo si toda la población del
numerador tiene denominador. En `territory.json` las regiones con cobertura de
matrícula < 95 % llevan `aproximada: true` y `sobreestima_max`; la UI las marca.

## Cómo agregamos territorio (decisiones propias)

- **Región**: nombres normalizados (NFD sin diacríticos). «Lima» del microdato reúne
  Lima Metropolitana + Región Lima; el mapa lo pinta sobre el polígono LIMA y el
  denominador INEI suma ambas. «Callao» ↔ «Prov. Const. del Callao» (INEI).
- **Distrito** (`by_district.json`): unión por **ubigeo** (IDDIST del GeoJSON); si no
  cruza, por `DEP|PROV|DIST` normalizado. Alias verificados: Pueblo Libre→Magdalena
  Vieja, Nasca→Nazca, San Juan de Iscos→Yscos, Daniel Alomía Robles→Alomias.
  53 distritos creados después de ~2015 (Veintiséis de Octubre, Mi Perú…) y 8 sin
  geometría en el GeoJSON (Santa Anita, Bellavista-Piura, La Punta…) quedan
  «sin dato» aunque tengan reportes: **no se imputan polígonos**.
- **Departamento (mapa 2024)**: 25 claves alineadas a `population.json` para que la
  tasa por 10,000 se calcule con matrícula INEI.

## Limitaciones vigentes

1. **Sin `anexo`**: si un código modular tiene varios servicios, no sabemos a cuál
   pertenece cada reporte. Pedirlo en la solicitud de transparencia.
2. **Sin `codinst`/`codlocal`**: no hay vista «institución completa» ni «campus».
3. **Un solo año de matrícula por colegio** (Censo 2024, vía la capa de origen): no
   hay serie histórica de tasas por colegio.
4. **Un reporte no es un caso**: `CODIGO_UNICO` identifica el reporte, no el hecho.
5. **Sin fecha de atención ni cierre**: no se puede medir tiempo de respuesta.

## Privacidad

La capa que ingerimos no contiene ningún dato personal (ni de menores ni de adultos:
sin director, teléfono, correo ni RUC). El padrón de ESCALE, si se integra, entrará
por **lista blanca** de campos (se nombra lo que entra; todo lo demás se descarta),
verificada en el script de descarga antes de escribir a disco.
