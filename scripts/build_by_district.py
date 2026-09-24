#!/usr/bin/env python3
"""
Agrega los reportes SíseVe del microdato (por colegio) a nivel DISTRITO y los
cruza con el GeoJSON distrital para el mapa (drill-down departamento → distritos).

Entradas
  data/processed/schools_index.json   lista de colegios {s,n,cm,d,p,r,g,nv,t,y[14]}
                                      (v2 con "y" por año; si falta "y" se completa
                                      con schools_detail.json de /tmp/oe-data)
  data/raw/peru_distrital_simple.geojson  GeoJSON crudo de juaneladio/peru-geojson
                                      (MPL-2.0). Se descarga si no existe.

Salidas
  data/geo/peru-distrital.geojson     GeoJSON adelgazado (4 props, 4 decimales)
  data/processed/by_district.json     {"distritos": {ubigeo|clave: {...}}, ...}

Sin dependencias externas (solo stdlib). Uso:
  python3 scripts/build_by_district.py [--precision 4]

Regla del observatorio: NO se inventan datos. Los distritos sin reportes en el
microdato no tienen entrada (el mapa los pinta "sin dato"). El match por nombre
se hace con nombres normalizados (NFD sin diacríticos, mayúsculas, sin puntuación)
de departamento + provincia + distrito; lo que no cruza se conserva con una clave
de nombre y se lista en "sin_match" para que sea auditable.
"""
import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHOOLS = os.path.join(ROOT, "data", "processed", "schools_index.json")
SCHOOLS_FALLBACK = "/tmp/oe-data/schools_index.json"
DETAIL_FALLBACK = "/tmp/oe-data/schools_detail.json"
RAW_GEO = os.path.join(ROOT, "data", "raw", "peru_distrital_simple.geojson")
RAW_GEO_URL = "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_distrital_simple.geojson"
OUT_GEO = os.path.join(ROOT, "data", "geo", "peru-distrital.geojson")
OUT_JSON = os.path.join(ROOT, "data", "processed", "by_district.json")

YEARS = list(range(2013, 2027))  # 2013..2026 (2026 parcial, corte 31-ago)
RETRIEVAL_DATE = "2026-09-24"
SOURCE = ("MINEDU — SíseVe, microdato 2013–2026 (acceso a la información pública); "
          "consolidado de fiorellatl/observatorio-violencia-escolar")


def norm(s):
    """NFD sin diacríticos, mayúsculas, sin puntuación, espacios colapsados."""
    s = re.sub(r"\([^)]*\)", " ", str(s or ""))  # "Quisqui (Kichki)" → "Quisqui"
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.upper()
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # "PROV. CONST. DEL CALLAO" → "CALLAO"
    s = re.sub(r"^PROV(INCIA)? CONST(ITUCIONAL)? DEL ", "", s)
    return s


# Alias verificados (mismo ubigeo, distinta grafía/nombre oficial antiguo en el GeoJSON de 2015).
# Clave y valor son tripletas (dep, prov, dist) YA normalizadas.
ALIASES = {
    ("LIMA", "LIMA", "PUEBLO LIBRE"): ("LIMA", "LIMA", "MAGDALENA VIEJA"),  # ubigeo 150121, nombre oficial hasta 2019
    ("ICA", "NASCA", "NASCA"): ("ICA", "NAZCA", "NAZCA"),
    ("JUNIN", "CHUPACA", "SAN JUAN DE ISCOS"): ("JUNIN", "CHUPACA", "SAN JUAN DE YSCOS"),
    ("HUANUCO", "LEONCIO PRADO", "DANIEL ALOMIA ROBLES"): ("HUANUCO", "LEONCIO PRADO", "DANIEL ALOMIAS ROBLES"),
}


def load_schools():
    path = SCHOOLS if os.path.exists(SCHOOLS) else SCHOOLS_FALLBACK
    with open(path, encoding="utf-8") as fh:
        schools = json.load(fh)
    print(f"colegios: {len(schools)} desde {path}")
    if schools and "y" not in schools[0]:
        # v1 sin serie anual: completar con schools_detail.json (slug → anios)
        if not os.path.exists(DETAIL_FALLBACK):
            sys.exit("schools_index sin campo 'y' y no existe " + DETAIL_FALLBACK)
        with open(DETAIL_FALLBACK, encoding="utf-8") as fh:
            detail = json.load(fh)
        for s in schools:
            an = (detail.get(s["s"]) or {}).get("anios") or {}
            s["y"] = [int((an.get(str(y)) or {}).get("total") or 0) for y in YEARS]
        print("serie anual completada desde schools_detail.json")
    return schools


def load_raw_geo():
    if not os.path.exists(RAW_GEO):
        os.makedirs(os.path.dirname(RAW_GEO), exist_ok=True)
        print("descargando", RAW_GEO_URL)
        urllib.request.urlretrieve(RAW_GEO_URL, RAW_GEO)
    with open(RAW_GEO, encoding="utf-8") as fh:
        return json.load(fh)


def round_coords(c, p):
    if isinstance(c[0], (int, float)):
        return [round(c[0], p), round(c[1], p)]
    return [round_coords(x, p) for x in c]


def slim_geo(raw, precision):
    """Conserva solo IDDIST/NOMBDIST/NOMBPROV/NOMBDEP y reduce precisión."""
    feats, sin_geom = [], []
    for f in raw["features"]:
        pr = f["properties"]
        props = {k: pr.get(k) for k in ("IDDIST", "NOMBDIST", "NOMBPROV", "NOMBDEP")}
        if not f.get("geometry"):
            sin_geom.append(props)
            continue
        feats.append({"type": "Feature", "properties": props,
                      "geometry": {"type": f["geometry"]["type"],
                                   "coordinates": round_coords(f["geometry"]["coordinates"], precision)}})
    return {"type": "FeatureCollection",
            "name": "peru_distrital (juaneladio/peru-geojson, MPL-2.0; adelgazado)",
            "features": feats}, sin_geom


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--precision", type=int, default=4, help="decimales de coordenadas (4 ≈ 11 m)")
    args = ap.parse_args()

    schools = load_schools()
    raw = load_raw_geo()
    geo, sin_geom = slim_geo(raw, args.precision)

    # Índices del GeoJSON: (dep, prov, dist) → ubigeo; y (dep, dist) → [ubigeo] como respaldo
    by_full, by_dep_dist = {}, defaultdict(list)
    geo_names = {}
    for f in raw["features"]:
        pr = f["properties"]
        key = (norm(pr["NOMBDEP"]), norm(pr["NOMBPROV"]), norm(pr["NOMBDIST"]))
        by_full[key] = pr["IDDIST"]
        by_dep_dist[(key[0], key[2])].append(pr["IDDIST"])
        geo_names[pr["IDDIST"]] = (pr["NOMBDIST"], pr["NOMBPROV"], pr["NOMBDEP"])

    # Agregación del microdato por (región, provincia, distrito)
    agg = {}
    for s in schools:
        k = (s["r"], s["p"], s["d"])
        a = agg.get(k)
        if a is None:
            a = agg[k] = {"t": 0, "n": 0, "y": [0] * len(YEARS)}
        a["t"] += int(s.get("t") or 0)
        a["n"] += 1
        for i, v in enumerate(s.get("y") or []):
            if i < len(YEARS):
                a["y"][i] += int(v or 0)

    distritos, sin_match = {}, []
    matched_reports = 0
    total_reports = sum(a["t"] for a in agg.values())
    for (r, p, d), a in sorted(agg.items()):
        key = (norm(r), norm(p), norm(d))
        how = "dep+prov+dist"
        if key in ALIASES:
            key, how = ALIASES[key], "alias"
        ubi = by_full.get(key)
        if ubi is None:
            cands = by_dep_dist.get((key[0], key[2]), [])
            if len(cands) == 1:
                ubi, how = cands[0], "dep+dist(unico)"
        if ubi is None:
            ck = "|".join(key)  # clave de nombre normalizado (sin polígono en el GeoJSON)
            sin_match.append({"key": ck, "departamento": r, "provincia": p, "distrito": d, "t": a["t"]})
            distritos[ck] = {"nombre": d, "provincia": p, "departamento": r,
                             "t": a["t"], "n_colegios": a["n"], "y": a["y"], "ubigeo": None}
            continue
        if ubi in distritos:  # dos tripletas del microdato al mismo polígono: sumar
            e = distritos[ubi]
            e["t"] += a["t"]; e["n_colegios"] += a["n"]
            e["y"] = [x + y for x, y in zip(e["y"], a["y"])]
        else:
            distritos[ubi] = {"nombre": d, "provincia": p, "departamento": r,
                              "t": a["t"], "n_colegios": a["n"], "y": a["y"], "ubigeo": ubi,
                              "match": how}
        matched_reports += a["t"]

    sin_geom_ids = {g["IDDIST"] for g in sin_geom}
    con_dato_sin_poligono = [{"ubigeo": u, **{k: distritos[u][k] for k in ("nombre", "provincia", "departamento", "t")}}
                             for u in distritos if u in sin_geom_ids]

    out = {
        "dataset": "reportes SíseVe por distrito, 2013–2026 (2026 parcial: ene–ago)",
        "source": SOURCE,
        "source_url": "https://github.com/fiorellatl/observatorio-violencia-escolar",
        "retrieval_date": RETRIEVAL_DATE,
        "reliability": "A",
        "note": ("Registro administrativo (reportes de presuntos hechos en SíseVe), NO prevalencia. "
                 "Un colegio se cuenta en el distrito donde está registrado. Sin datos por año → 0 "
                 "(no se imputa)."),
        "years": YEARS,
        "key": ("ubigeo INEI de 6 dígitos (IDDIST del GeoJSON) cuando el distrito cruza con "
                "data/geo/peru-distrital.geojson; si no cruza, clave 'DEP|PROV|DIST' con nombres "
                "normalizados (NFD sin diacríticos, mayúsculas, sin puntuación) y ubigeo=null"),
        "geojson": "data/geo/peru-distrital.geojson (juaneladio/peru-geojson, MPL-2.0; props IDDIST, NOMBDIST, NOMBPROV, NOMBDEP)",
        "coverage": {
            "distritos_microdato": len(agg),
            "con_match": len(agg) - len(sin_match),
            "sin_match": len(sin_match),
            "reportes_total": total_reports,
            "reportes_con_match": matched_reports,
            "pct_reportes_con_match": round(100.0 * matched_reports / total_reports, 2) if total_reports else None,
            "poligonos_geojson": len(geo["features"]),
            "geojson_sin_geometria": sin_geom,
            "con_dato_sin_poligono": con_dato_sin_poligono,
        },
        "sin_match": sin_match,
        "distritos": distritos,
    }

    os.makedirs(os.path.dirname(OUT_GEO), exist_ok=True)
    with open(OUT_GEO, "w", encoding="utf-8") as fh:
        json.dump(geo, fh, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))

    cov = out["coverage"]
    print(f"GeoJSON: {len(geo['features'])} polígonos → {OUT_GEO} ({os.path.getsize(OUT_GEO)/1e6:.2f} MB)")
    print(f"        {len(sin_geom)} distritos del GeoJSON sin geometría: {[g['NOMBDIST'] for g in sin_geom]}")
    print(f"distritos microdato: {cov['distritos_microdato']}  con match: {cov['con_match']}  sin match: {cov['sin_match']}")
    print(f"reportes mapeados: {cov['reportes_con_match']}/{cov['reportes_total']} ({cov['pct_reportes_con_match']}%)")
    print(f"con dato pero sin polígono: {[(x['nombre'], x['departamento'], x['t']) for x in con_dato_sin_poligono]}")
    if sin_match:
        print("sin match (primeros 40):")
        for x in sin_match[:40]:
            print(f"  {x['departamento']} / {x['provincia']} / {x['distrito']}  t={x['t']}")
    print(f"→ {OUT_JSON} ({os.path.getsize(OUT_JSON)/1e6:.2f} MB)")


if __name__ == "__main__":
    main()
