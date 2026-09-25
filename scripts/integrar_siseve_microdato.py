#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integra el MICRODATO OFICIAL de SíseVe 2013-2026 al Observatorio.

Fuente primaria: MINEDU - SíseVe, obtenido vía SOLICITUD DE ACCESO A LA
INFORMACIÓN PÚBLICA. El consolidado que leemos aquí fue publicado por el
Observatorio de Violencia Escolar (github.com/fiorellatl/observatorio-violencia-escolar,
data/public/*.json) y lo vendoramos en data/raw/observatorio-escolar/ con atribución.

Este script NO inventa cifras: solo reordena el microdato oficial a nuestro esquema.

Regla del Observatorio (docs/METHODOLOGY.md): registro ≠ exposición. Por eso
tomamos SOLO agregados (nacional, tipología por año, territorio región/UGEL,
correlación anonimizada). NO importamos rankings de colegios individuales.

Salidas:
  data/processed/timeseries.json   (serie nacional oficial completa + tipología)
  data/processed/by_department.json (2024 oficial, 25 regiones + tasa)
  data/processed/territory.json     (nuevo: 25 regiones con serie 2013-2026)
  data/processed/correlation.json   (nuevo: física vs psicológica, anonimizado)
"""
import json, os, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "observatorio-escolar"
OUT = ROOT / "data" / "processed"
RETRIEVAL = "2026-09-24"

ATRIB = ("MINEDU — SíseVe, microdato 2013–2026 obtenido vía solicitud de acceso a la "
         "información pública. Consolidado publicado por el Observatorio de Violencia "
         "Escolar (github.com/fiorellatl/observatorio-violencia-escolar).")

def load(name):
    return json.load(open(RAW / name, encoding="utf-8"))

def dump(name, obj):
    p = OUT / name
    json.dump(obj, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"  ✓ {p.relative_to(ROOT)}  ({p.stat().st_size:,} bytes)")

def norm(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").upper()
    return s.replace("PROV. CONST. DEL ", "").strip()

# ---------------------------------------------------------------- timeseries
def build_timeseries():
    nat = load("national.json")            # lista de dicts por año
    nat = sorted(nat, key=lambda r: int(r["anio"]))
    years = [int(r["anio"]) for r in nat]
    def col(k):
        return [r.get(k) for r in nat]

    violencia = col("total")
    fisica, psico, sexual = col("fisica"), col("psicologica"), col("sexual")
    entre, personal = col("entre_escolares"), col("personal_ie")
    bullying, ciber = col("bullying"), col("ciberacoso")

    # Verificación MECE: física+psico+sexual == total  y  entre+personal == total
    for i, y in enumerate(years):
        a = (fisica[i] or 0) + (psico[i] or 0) + (sexual[i] or 0)
        b = (entre[i] or 0) + (personal[i] or 0)
        assert a == violencia[i], f"tipo != total en {y}: {a} vs {violencia[i]}"
        assert b == violencia[i], f"vínculo != total en {y}: {b} vs {violencia[i]}"
    print("  · MECE verificado: física+psico+sexual = total = entre+personal (todos los años)")

    n = len(years)
    A = ["A"] * n
    ts = {
        "dataset": "Serie histórica de reportes SíseVe (microdato oficial)",
        "source": "MINEDU — SíseVe (microdato 2013–2026, acceso a la información pública)",
        "source_url": "https://siseve.minedu.gob.pe/Web/App/Mapa",
        "source_microdato": ATRIB,
        "retrieval_date": RETRIEVAL,
        "partial_year": 2026,
        "note": ("SíseVe registra REPORTES de presuntos hechos, no la prevalencia real. "
                 "Serie completa 2013–2026 proveniente del MICRODATO OFICIAL de SíseVe "
                 "(solicitud de acceso a la información pública): ya no dependemos de prensa "
                 "para 2023–2026. 2020 y 2021 son cifras oficiales bajas por el cierre de "
                 "escuelas (educación remota): la caída NO significa menos violencia real. "
                 "2026 es parcial (enero–agosto) y no es comparable con años completos."),
        "years": years,
        # Claves compatibles con el frontend actual (KPIs y serie histórica):
        "series": {
            "violencia": violencia,
            "bullying": bullying,
            "ciberbullying": ciber,
        },
        "reliability": {
            "violencia": list(A),
            "bullying": list(A),
            "ciberbullying": list(A),
        },
        # Desglose MECE por año (suman al total). Nuevo:
        "tipos": {
            "labels": {"fisica": "Física", "psicologica": "Psicológica", "sexual": "Sexual"},
            "fisica": fisica, "psicologica": psico, "sexual": sexual,
        },
        # Vínculo agresor↔víctima (MECE, suman al total). Nuevo:
        "vinculo": {
            "labels": {"entre_escolares": "Entre escolares",
                       "personal_ie": "De personal de la IE hacia escolar"},
            "entre_escolares": entre, "personal_ie": personal,
        },
        # bullying / ciberacoso son ETIQUETAS transversales (subconjuntos del total):
        "etiquetas_nota": ("‘Bullying’ y ‘ciberacoso’ son etiquetas transversales del "
                           "microdato SíseVe: un caso puede ser a la vez, p. ej., físico y "
                           "bullying, por eso NO se suman con física/psicológica/sexual."),
        "year_notes": {
            "2019": "13,001 reportes. Máximo previo a la pandemia.",
            "2020": "755 reportes (oficial). Escuelas cerradas por COVID-19: la fuerte caída refleja la educación remota y menos mecanismos de reporte, no menos violencia real.",
            "2021": "768 reportes (oficial). Continúa la educación remota.",
            "2022": "12,025 reportes. Retorno a la presencialidad.",
            "2023": "19,722 reportes — pico de la serie (microdato oficial; antes lo teníamos solo por prensa).",
            "2024": "19,297 reportes (microdato oficial).",
            "2025": "19,531 reportes (microdato oficial).",
            "2026": "11,791 reportes, parcial ene–ago (microdato oficial). No comparable con años completos.",
        },
        "reliability_note": ("Toda la serie es de nivel A (oficial). Antes 2023 era ‘B’ "
                             "(prensa); ahora proviene del microdato oficial obtenido por "
                             "acceso a la información pública."),
        "source_tablero": "https://siseve.minedu.gob.pe/Web/App/Mapa",
        "annotations": [
            {"year": 2018, "label": "DS 004-2018 Lineamientos"},
            {"year": 2020, "label": "Pandemia (escuelas cerradas)"},
            {"year": 2023, "label": "Ley 31902"},
        ],
    }
    dump("timeseries.json", ts)
    return years

# ---------------------------------------------------------------- territory
def build_territory():
    terr = load("territorio.json")
    meta = load("meta.json")
    regiones = terr["regiones"]
    out = {
        "dataset": "Reportes SíseVe por región (microdato oficial)",
        "source": ATRIB,
        "retrieval_date": RETRIEVAL,
        "anio_transversal": terr.get("anio", 2024),
        "corte": meta.get("corte"),
        "note": ("Tasa = reportes por 1,000 estudiantes con matrícula ≥100 (denominador: "
                 "Padrón/Censo Educativo 2024). ‘aproximada=true’ marca cobertura de "
                 "denominador <95%. Registro administrativo, no prevalencia."),
        "cobertura": terr.get("cobertura"),
        "regiones": [
            {
                "nombre": r["nombre"],
                "reportes": r["reportes"],
                "alumnos": r["alumnos"],
                "instituciones": r.get("instituciones"),
                "cobertura": r.get("cobertura"),
                "tasa_x1000": r.get("tasa"),
                "aproximada": r.get("aproximada", False),
                "serie": r.get("serie", {}),
            }
            for r in sorted(regiones, key=lambda x: x["nombre"])
        ],
    }
    dump("territory.json", out)
    return terr

# ---------------------------------------------------------------- by_department
def build_by_department(terr):
    """Actualiza SOLO el año 2024 a OFICIAL (25 regiones) conservando 2022 y 2026."""
    bd = json.load(open(OUT / "by_department.json", encoding="utf-8"))
    pop = json.load(open(OUT / "population.json", encoding="utf-8"))
    popkeys = [d["department"] for d in pop["data"]]
    popnorm = {norm(k): k for k in popkeys}   # p.ej. "CALLAO" -> "Prov. Const. del Callao"

    # Todos los años 2013–2026 desde la serie por región del microdato (25 regiones, nivel A).
    # Así el mapa, la tabla y el CSV cuadran con la serie nacional (revisión de datos 25-09-2026:
    # antes 2022 venía del boletín = 12,099 vs 12,025 del microdato, y 2026 de prensa con 11 regiones).
    unmatched = []
    def keyfor(name):
        nkey = norm(name)
        if nkey == "LIMA": return "Lima"            # deptRows agrega Metropolitana + Región vía /lima/
        if nkey in popnorm: return popnorm[nkey]    # Callao -> "Prov. Const. del Callao", etc.
        unmatched.append(name); return name
    years = sorted({y for r in terr["regiones"] for y in r["serie"].keys()})
    for k in [k for k in bd if k.isdigit()]: del bd[k]
    bd["reliability_by_year"] = {}
    for y in years:
        bd[y] = {keyfor(r["nombre"]): {"cases": int(r["serie"].get(y, 0) or 0)} for r in terr["regiones"]}
        bd["reliability_by_year"][y] = "A"
    bd["source_2024_url"] = "https://siseve.minedu.gob.pe/Web/App/Mapa"
    bd["default_year"] = 2024
    bd["partial_year"] = 2026
    bd["source"] = ATRIB
    bd["retrieval_date"] = RETRIEVAL
    bd["note"] = ("Todos los años (2013–2026) provienen del microdato oficial SíseVe agregado por región "
                  "(25 regiones, acceso a la información pública) y cuadran con la serie nacional. "
                  "2026 es parcial (ene–ago). 2020–2021: cierre de escuelas, no comparables.")
    if unmatched: print("  ⚠ regiones sin match con population.json:", set(unmatched))
    else: print(f"  · {len(years)} años × 25 regiones mapeados a population.json (tasas calculables)")
    dump("by_department.json", bd)

# ---------------------------------------------------------------- correlation
def build_breakdowns_growth():
    """Reemplaza el crecimiento por tipo de prensa (+35 % sexual, incompatible con el total oficial:
    revisión de datos 25-09-2026) por el crecimiento 2025 vs 2024 del microdato oficial."""
    nat = sorted(load("national.json"), key=lambda r: int(r["anio"]))
    by = {int(r["anio"]): r for r in nat}
    a, b = by[2024], by[2025]
    rows = [{"tipo": lab, "casos_2024": a[k], "casos_2025": b[k], "var_pct": round((b[k] - a[k]) / a[k] * 100, 1)}
            for k, lab in (("sexual", "Sexual"), ("fisica", "Física"), ("psicologica", "Psicológica"))]
    rows.sort(key=lambda r: -r["var_pct"])
    p = OUT / "breakdowns.json"
    bd = json.load(open(p, encoding="utf-8"))
    bd["crecimiento_tipo"] = {
        "note": ("Variación de reportes por tipo entre los dos últimos años completos (2025 vs 2024), microdato "
                 "oficial. Sustituye a la cifra de prensa (+35 % sexual ene–ago 2026) que era aritméticamente "
                 "incompatible con el crecimiento total oficial de ene–ago (+12.7 %)."),
        "source": ATRIB, "source_url": "https://siseve.minedu.gob.pe/Web/App/Mapa",
        "years": [2024, 2025], "data": rows}
    bd.pop("crecimiento_tipo_2026", None)
    json.dump(bd, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("  · crecimiento por tipo 2025 vs 2024:", ", ".join(f"{r['tipo']} {r['var_pct']:+}%" for r in rows))

def build_correlation():
    cor = load("correlacion.json")
    out = {
        "dataset": "Correlación reportes físicos vs psicológicos por colegio (anonimizado)",
        "source": ATRIB,
        "retrieval_date": RETRIEVAL,
        "note": ("Cada punto agrupa colegios por su número de reportes físicos (x) y "
                 "psicológicos (y); el tamaño es cuántos colegios caen en esa combinación. "
                 "NO se identifica ningún colegio (registro ≠ exposición). ‘r’ es el "
                 "coeficiente de correlación de Pearson del año."),
        "anios": cor["anios"],
        "anio_parcial": cor.get("anio_parcial"),
        "datos": cor["datos"],
    }
    dump("correlation.json", out)

if __name__ == "__main__":
    print("Integrando microdato oficial SíseVe →", OUT.relative_to(ROOT))
    build_timeseries()
    terr = build_territory()
    build_by_department(terr)
    build_breakdowns_growth()
    print("  · correlación: ver scripts/build_correlation.py (cálculo propio; el correlacion.json de la fuente mide otro par)")
    print("Listo.")
