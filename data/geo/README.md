# Geometrías (GeoJSON)

| Archivo | Nivel | Polígonos | Tamaño | Origen |
|---|---|---|---|---|
| `peru-departamental.geojson` | departamentos | 25 | 0.14 MB | juaneladio/peru-geojson — `peru_departamental_simple.geojson` |
| `peru-distrital.geojson` | distritos | 1 826 | 0.84 MB | juaneladio/peru-geojson — `peru_distrital_simple.geojson` |

## Atribución y licencia

Ambos archivos derivan de [juaneladio/peru-geojson](https://github.com/juaneladio/peru-geojson),
publicado bajo **Mozilla Public License 2.0 (MPL-2.0)**. Los límites provienen originalmente de
la cartografía oficial (INEI / MINAM) de ~2015. Se conserva la atribución en el control de
atribución del mapa.

## Adelgazado del GeoJSON distrital

`scripts/build_by_district.py` descarga el archivo crudo a `data/raw/` (no versionado) y genera
`peru-distrital.geojson` conservando solo cuatro propiedades y reduciendo la precisión de las
coordenadas a 4 decimales (≈ 11 m), suficiente para un coroplético:

| Propiedad | Ejemplo | Uso |
|---|---|---|
| `IDDIST` | `150121` | **ubigeo INEI** (6 dígitos) — clave de `data/processed/by_district.json` |
| `NOMBDIST` | `MAGDALENA VIEJA` | nombre del distrito (grafía de 2015) |
| `NOMBPROV` | `LIMA` | provincia |
| `NOMBDEP` | `LIMA` | departamento (Lima Metropolitana y Región Lima comparten `LIMA`; Callao = `CALLAO`) |

## Limitaciones conocidas (no se inventan polígonos)

- **8 distritos vienen sin geometría** en el archivo de origen y por eso no aparecen en el mapa
  aunque tengan reportes: Santa Anita (Lima, 669 reportes), Bellavista (Piura), La Punta (Callao),
  Acopampa (Áncash), Trita y El Parco (Amazonas), Goyllarisquizga (Pasco), Amantaní (Puno).
- **Distritos creados después de ~2015 no existen en el GeoJSON** (53 tripletas del microdato,
  1.03 % de los reportes): p. ej. Veintiséis de Octubre (Piura), Mi Perú (Callao), Andrés Avelino
  Cáceres Dorregaray (Ayacucho), La Yarada-Los Palos (Tacna), Neshuya/Alexander von Humboldt
  (Ucayali), Castillo Grande (Huánuco). Sus reportes quedan en `by_district.json` con clave de
  nombre (`DEP|PROV|DIST`, `ubigeo: null`) y se listan en `sin_match`.
- Alias aplicados por cambio de nombre oficial u ortografía (mismo ubigeo): Pueblo Libre →
  `MAGDALENA VIEJA`, Nasca → `NAZCA`, San Juan de Iscos → `SAN JUAN DE YSCOS`,
  Daniel Alomía Robles → `DANIEL ALOMIAS ROBLES`.

Cobertura del cruce (24-sep-2026): 1 714 de 1 767 distritos del microdato con polígono;
**98.97 %** de los 122 984 reportes 2013–2026 quedan mapeados.
