# Solicitud de acceso a la información pública — base SíseVe desagregada por institución educativa

> Plantilla lista para presentar. Adaptada, con mejoras, de
> `docs/solicitud-transparencia.md` del
> [Observatorio de Violencia Escolar](https://github.com/fiorellatl/observatorio-violencia-escolar).
> **Mejoras**: se pide expresamente **sin** ningún campo del estudiante ni del presunto
> agresor (la entrega de 2026 a ese equipo sí los incluyó y obligó a anonimizar);
> se añaden `ANEXO`, fechas de atención/cierre y diccionario; se cita el precedente
> de 2026; se pide entrega periódica o publicación en Datos Abiertos.
>
> **Vía**: Mesa de Partes Virtual del MINEDU (https://www.gob.pe/minedu → «Mesa de
> Partes Digital») o el Formulario de Solicitud de Acceso a la Información Pública
> del portal de transparencia. **Base legal**: Ley N° 27806, TUO aprobado por D.S.
> N° 021-2019-JUS. **Plazo**: 10 días hábiles, prorrogables por 2 previa comunicación.
> Rellenar los campos entre `[corchetes]`.

---

**Señores**
Ministerio de Educación del Perú
Unidad de Transparencia y Acceso a la Información Pública / Funcionario Responsable de Acceso a la Información

**Solicitante:** Carlos Mauro Cárdenas Fernández
**Documento de identidad:** DNI [número]
**Correo para notificación:** carlos@cardenas.pe
**Fecha:** [fecha]

**Asunto:** Solicitud de acceso a información pública — base de datos de reportes del
Sistema Especializado en Reporte de Casos sobre Violencia Escolar (SíseVe),
desagregada por institución educativa, **sin datos personales**.

---

## I. Petitorio

Al amparo del artículo 2°, numeral 5, de la Constitución Política del Perú y del TUO
de la Ley N° 27806, solicito se me entregue **en formato electrónico reutilizable
(CSV o XLSX)** la base de datos de reportes registrados en la plataforma SíseVe, con
el siguiente detalle.

### Período
Del **1 de enero de 2013** (inicio del sistema) al **[último corte disponible]**. De
no ser posible el período completo, la serie más extensa que obre en la entidad,
indicando la fecha de inicio de la cobertura entregada.

### Unidad de registro
**Un registro por reporte**, no agregados ni tablas resumen.

### Campos solicitados

| Campo | Descripción |
|---|---|
| `CODIGO_UNICO` | Identificador del reporte (sin datos del denunciante) |
| `FECHA_REPORTE` | Fecha de registro |
| `ANIO` | Año del reporte |
| `CODIGO_MODULAR` | **Código modular de la institución educativa** |
| `ANEXO` | **Anexo del servicio educativo** (para distinguir servicios que comparten código modular) |
| `NOMBRE_IE` | Nombre de la institución educativa |
| `CODIGO_UGEL` / `UGEL` · `CODIGO_DRE` / `DRE` | Instancia de gestión |
| `UBIGEO` · `DISTRITO` · `PROVINCIA` · `REGION` | Ubicación |
| `TIPO_GESTION` | Pública / privada |
| `AREA` | Urbana / rural |
| `MODALIDAD` · `NIVEL_EDUCATIVO` | Básica Regular/Alternativa/Especial; Inicial/Primaria/Secundaria |
| `TIPO_REPORTE` | Entre escolares / Personal de la IE hacia escolares |
| `TIPO_VIOLENCIA` · `SUBTIPO_VIOLENCIA` | Física, psicológica, sexual; subtipo vigente |
| `FRECUENCIA` | Categoría del formulario |
| `ESTADO_REPORTE` | Estado de atención al corte |
| `FECHA_ATENCION` · `FECHA_CIERRE` | Fechas de inicio de atención y de cierre o cambio de estado, **de existir** |

**Campos que expresamente NO se solicitan** (y que, de existir en la base, pido que
se **omitan** en la entrega): edad, sexo, idioma, grado, turno y relación del
estudiante agredido; sexo, edad y relación del presunto agresor; dirección exacta de
la IE; nombres o datos de denunciantes; y cualquier texto libre (`MOTIVO_VIOLENCIA`
u observaciones). Esta solicitud se limita a atributos de la **institución educativa**
y a la categorización administrativa del reporte.

### Petitorio complementario: tablas agregadas por sexo (sin datos personales)
Dado que **no solicito** el sexo ni la edad de personas concretas, pido adicionalmente
**tablas agregadas** (conteos, no registros) que sí permiten análisis de género sin
identificar a nadie:

| Tabla | Dimensiones |
|---|---|
| A | `ANIO` × `REGION` × `TIPO_VIOLENCIA` × **sexo del estudiante agredido** |
| B | `ANIO` × `REGION` × `TIPO_REPORTE` × **sexo del presunto agresor** |
| C | `ANIO` × `NIVEL_EDUCATIVO` × `TIPO_VIOLENCIA` × sexo del agredido × sexo del presunto agresor |

Con **supresión de celdas menores a 5** si la entidad lo considera necesario. Estas
tablas son estadística agregada y no contienen datos personales.

### Documentación complementaria
Solicito adjuntar el **diccionario de datos** (definición de cada campo, catálogo de
valores de los campos categóricos y criterio de cierre de casos) y, de existir, la
**nota metodológica** sobre cambios de clasificación entre años (p. ej. subtipos
incorporados a partir de 2018 y 2023).

### Entrega periódica
Solicito además que se indique si la entidad puede **publicar esta base de forma
periódica** en la Plataforma Nacional de Datos Abiertos (datosabiertos.gob.pe) o
remitir actualizaciones trimestrales, dado que la información se genera de manera
continua y su reutilización tiene interés público.

## II. Fundamento

1. **Existe precedente institucional de entrega, reciente y en la forma solicitada.**
   El propio Ministerio entregó en 2026, mediante solicitud de acceso a la
   información pública (Mesa de Partes Digital, expediente **MPD 2026 EXT-0825304**,
   archivo `AnexoMPD2026EXT0825304.xlsx`, hoja `ReporteCasos`), la base de reportes
   SíseVe desagregada por código modular para el período 2013 – agosto 2026
   (122,984 registros). Asimismo, en 2023 entregó una base equivalente que sustentó la
   investigación periodística *ECData* del diario El Comercio.

2. **No se solicita ningún dato personal; al contrario, se pide excluirlos.** El
   petitorio comprende exclusivamente atributos de la IE (persona jurídica o
   dependencia del Estado) y la categorización administrativa del reporte. No resulta
   aplicable la excepción del artículo 17°, numeral 5, del TUO de la Ley N° 27806, ni
   la Ley N° 29733 de Protección de Datos Personales. La omisión de las columnas
   sensibles es una **operación de selección de columnas**, no de producción de
   información nueva.

3. **La información obra en poder de la entidad en la forma solicitada.** El reporte
   público que el portal SíseVe pone a disposición (`Descargar Excel`, en
   `siseve.minedu.gob.pe/Web/App/Mapa`) ya entrega un listado **caso por caso** con
   `FECHA_REPORTE`, `DRE`, `UGEL`, `NIVEL_EDUCATIVO`, `TIPO_REPORTE`, `TIPO_VIOLENCIA`,
   `SUBTIPO_VIOLENCIA` y `TIPO_ESTADO_REPORTE`. Se pide ese mismo archivo con las
   columnas de identificación de la IE que el sistema necesariamente registra, pues
   cada reporte se asigna a una institución educativa determinada.

4. **El Ministerio ya publica indicadores por código modular** (Padrón de IIEE en
   ESCALE, fichas de Identicole), por lo que el código modular no constituye
   información reservada.

5. **Finalidad** (a título informativo, sin que exista obligación de expresarla,
   art. 7° del TUO): investigación cívica y de incidencia sobre violencia escolar,
   publicada como datos abiertos agregados en el Observatorio Nacional del Bullying
   en el Perú (https://unimauro.github.io/bullying-peru/), con reglas explícitas de
   no publicación de datos individuales.

## III. Forma de entrega
Entrega en **formato digital** al correo consignado o mediante enlace de descarga.
De generarse costo de reproducción, solicito se me informe previamente el monto
liquidado y el procedimiento de pago (art. 20° del TUO).

## IV. Reserva de derechos
De denegarse total o parcialmente lo solicitado, solicito que la respuesta exprese
por escrito **la excepción específica invocada**, con la norma, el razonamiento y el
plazo de la reserva (art. 13° del TUO). Me reservo el derecho de interponer recurso
de apelación ante el Tribunal de Transparencia y Acceso a la Información Pública.

Atentamente,

**Carlos Mauro Cárdenas Fernández**
DNI [número]

---

## Notas prácticas

- **Entrega parcial como plan B.** Si objetan `NOMBRE_IE`, basta `CODIGO_MODULAR` +
  `ANEXO`: se cruza con el Padrón de ESCALE (público) y de ahí salen nombre,
  dirección, distrito, gestión y nivel.
- **Argumento decisivo**: el punto 1 (ya lo entregaron en 2026 y en 2023) y el punto 3
  (el Estado ya publica el archivo caso por caso; se piden columnas, no un producto).
- **Si alegan datos personales**: responder que se pidió **excluirlos** y que una IE
  no es persona natural.
- **Plazo y silencio.** Vencidos los 10 días hábiles sin respuesta opera la
  denegatoria ficta y queda expedito el recurso de apelación ante el Tribunal de
  Transparencia (15 días hábiles desde el vencimiento).
- **Al recibirlo**: guardar en `data/raw/` (git-ignored), agregar con un script que
  declare las columnas que nunca lee y que falle si aparece un campo personal; ver
  `PIPELINE.md` («Privacidad como puerta»). Nunca subir el archivo al repositorio.
- **Registro**: anotar en `DATA_GAPS.md` fecha de presentación, número de expediente,
  fecha de respuesta y corte de los datos.
