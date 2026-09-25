#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Costo de los colegios (pensión mensual declarada) por distrito, y su relación
DESCRIPTIVA con los reportes SíseVe 2024.

Fuentes (capa pública de fiorellatl/observatorio-violencia-escolar):
  data/raw/observatorio-escolar/cross_2024.json  — 13,616 servicios con matrícula,
      reportes y tasa 2024 (por 1,000) y pensión (Identicole 2024/2025, DECLARATIVA:
      la informa el propio colegio; solo privados con ficha).
  data/raw/observatorio-escolar/institutions.json — para el año de la pensión.

Salida: data/processed/pension_distritos.json
  {"distritos":[{region,distrito, n_privados_con_pension, pension:{mediana,p25,p75,min,max},
                 tasa_2024:{mediana_con_pension, mediana_publicos, mediana_privados_sin_dato},
                 reportes_2024:{privados_con_pension, publicos}, n_servicios_2024}],
   "tramos":[{tramo, n, tasa_mediana, reportes, matricula}]}   # nacional, por tramo de pensión
Reglas: no se inventa nada; distritos con < 5 privados con pensión NO reciben estadísticas
de pensión (n insuficiente); toda lectura es descriptiva (confusores declarados en la UI).
"""
import json, statistics as st
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "observatorio-escolar"
OUT = ROOT / "data" / "processed" / "pension_distritos.json"
MIN_N = 5
TRAMOS = [(0, 300, "≤ S/ 300"), (300, 600, "S/ 301–600"), (600, 1000, "S/ 601–1,000"), (1000, 1500, "S/ 1,001–1,500"), (1500, 2500, "S/ 1,501–2,500"), (2500, 1e9, "> S/ 2,500")]

def q(vals, p):
    vals = sorted(vals); k = (len(vals) - 1) * p; f = int(k); c = min(f + 1, len(vals) - 1)
    return round(vals[f] + (vals[c] - vals[f]) * (k - f), 0)

def main():
    src = RAW / "cross_2024.json"
    if not src.exists():
        alt = Path("/tmp/oe-data/cross_2024.json")
        if alt.exists(): src.write_bytes(alt.read_bytes())
        else: raise SystemExit("falta cross_2024.json (bájalo de fiorellatl/observatorio-violencia-escolar/data/public/)")
    rows = json.load(open(src, encoding="utf-8"))
    inst = json.load(open(RAW / "institutions.json", encoding="utf-8"))
    region_of, anio_of = {}, {}
    for v in inst.values():
        for s in v.get("servicios", []):
            region_of[s["cm"]] = v.get("departamento"); anio_of[s["cm"]] = s.get("anio_pension")
    cm_of = {}
    for v in inst.values():
        for s in v.get("servicios", []): cm_of[s["slug"]] = s["cm"]

    by = defaultdict(lambda: {"pen": [], "tasa_pen": [], "tasa_pub": [], "tasa_priv_sin": [], "rep_pen": 0, "rep_pub": 0, "n": 0, "anios": set()})
    tramo = defaultdict(lambda: {"n": 0, "tasas": [], "rep": 0, "mat": 0})
    for r in rows:
        cm = cm_of.get(r["slug"]) or r["slug"].rsplit("-", 1)[-1]
        reg = region_of.get(cm) or ""
        key = (reg, r.get("distrito") or "")
        b = by[key]; b["n"] += 1
        tasa, pen, priv = r.get("tasa"), r.get("pension"), r.get("gestion") == "Privado"
        if priv and pen:
            b["pen"].append(pen); b["rep_pen"] += r.get("reportes", 0) or 0
            if tasa is not None: b["tasa_pen"].append(tasa)
            if anio_of.get(cm): b["anios"].add(anio_of[cm])
            for lo, hi, lab in TRAMOS:
                if lo < pen <= hi:
                    t = tramo[lab]; t["n"] += 1; t["rep"] += r.get("reportes", 0) or 0; t["mat"] += r.get("matricula", 0) or 0
                    if tasa is not None: t["tasas"].append(tasa)
                    break
        elif priv:
            if tasa is not None: b["tasa_priv_sin"].append(tasa)
        else:
            b["rep_pub"] += r.get("reportes", 0) or 0
            if tasa is not None: b["tasa_pub"].append(tasa)

    out = []
    for (reg, dist), b in by.items():
        d = {"region": reg, "distrito": dist, "n_servicios_2024": b["n"], "n_privados_con_pension": len(b["pen"]),
             "reportes_2024": {"privados_con_pension": b["rep_pen"], "publicos": b["rep_pub"]},
             "tasa_2024": {"mediana_publicos": round(st.median(b["tasa_pub"]), 2) if b["tasa_pub"] else None,
                           "mediana_privados_sin_dato": round(st.median(b["tasa_priv_sin"]), 2) if b["tasa_priv_sin"] else None,
                           "mediana_con_pension": round(st.median(b["tasa_pen"]), 2) if len(b["tasa_pen"]) >= MIN_N else None}}
        if len(b["pen"]) >= MIN_N:
            d["pension"] = {"mediana": st.median(b["pen"]), "p25": q(b["pen"], .25), "p75": q(b["pen"], .75), "min": min(b["pen"]), "max": max(b["pen"]),
                            "anios": sorted(b["anios"])}
        else:
            d["pension"] = None
        out.append(d)
    out.sort(key=lambda d: (-(d["pension"]["mediana"] if d["pension"] else -1), d["region"], d["distrito"]))
    tr = [{"tramo": lab, "n": tramo[lab]["n"], "tasa_mediana": round(st.median(tramo[lab]["tasas"]), 2) if tramo[lab]["tasas"] else None,
           "reportes": tramo[lab]["rep"], "matricula": tramo[lab]["mat"],
           "reportes_x1000": round(tramo[lab]["rep"] / tramo[lab]["mat"] * 1000, 2) if tramo[lab]["mat"] else None}
          for _, _, lab in TRAMOS if tramo[lab]["n"]]
    meta = {"dataset": "Pensión mensual declarada por distrito y su relación descriptiva con los reportes SíseVe 2024",
            "source": ("Pensión: Identicole (MINEDU), declarada por cada colegio privado, 2024–2025. Reportes y matrícula 2024: "
                       "microdato SíseVe (acceso a la información pública) + Padrón/Censo 2024; consolidado de "
                       "fiorellatl/observatorio-violencia-escolar (cross_2024.json)."),
            "retrieval_date": "2026-09-25", "min_n": MIN_N,
            "note": ("Solo colegios privados con pensión declarada (1,854 servicios en el país). Distritos con menos de "
                     f"{MIN_N} privados con dato no reciben estadísticas de pensión. La tasa es por 1,000 estudiantes "
                     "matriculados (2024). Registro ≠ prevalencia: más reportes suele reflejar mejor cultura de denuncia; "
                     "familias con más recursos escalan más los casos. Ninguna asociación admite lectura causal."),
            "n_distritos": len(out), "n_distritos_con_pension": sum(1 for d in out if d["pension"]),
            "tramos": tr, "distritos": out}
    json.dump(meta, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"distritos: {len(out)} · con pensión (n≥{MIN_N}): {meta['n_distritos_con_pension']} · {OUT.stat().st_size/1e3:.0f} KB")
    for t in tr: print(f"  {t['tramo']:>14}: n={t['n']:4d}  tasa mediana={t['tasa_mediana']}  reportes/1000={t['reportes_x1000']}")
    for d in out[:6]: print(f"  {d['distrito']} ({d['region']}): n={d['n_privados_con_pension']} mediana S/ {d['pension']['mediana']} · tasa con pensión {d['tasa_2024']['mediana_con_pension']} vs públicos {d['tasa_2024']['mediana_publicos']}")

if __name__ == "__main__":
    main()
