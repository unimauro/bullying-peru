#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capa de INSTITUCIONES (colegio completo = codinst) a partir de la capa pública
institutions.json del Observatorio de Violencia Escolar (fiorellatl), que agrupa
los servicios educativos (código modular = un nivel) bajo la institución del
Padrón ESCALE. Sirve para la vista "institución completa" (inicial + primaria +
secundaria = un colegio) y para el resumen por distrito.

Entrada (git-ignored, se descarga si falta):
  data/raw/observatorio-escolar/institutions.json  (~20 MB)
Salida:
  data/processed/institutions_index.json  (compacto)  — todas las instituciones
  data/processed/institutions/<region-slug>.json       — detalle por región

No hay datos personales en la entrada ni en la salida (sin director, teléfono,
correo, RUC, dirección). Regla del observatorio: no inventar cifras; matrícula y
tasa vienen de la fuente y se copian tal cual, con su año.
"""
import json, os, sys, unicodedata, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "observatorio-escolar"
OUT = ROOT / "data" / "processed"
SRC = "https://raw.githubusercontent.com/fiorellatl/observatorio-violencia-escolar/main/data/public/institutions.json"
YEARS = [str(y) for y in range(2013, 2027)]
TIPOS = ["fisica", "psicologica", "sexual", "bullying", "ciberacoso", "entre_escolares", "personal_ie"]

def slug(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    out = "".join(c if c.isalnum() else "-" for c in s)
    while "--" in out: out = out.replace("--", "-")
    return out.strip("-")

def years_vec(anios, key="total"):
    return [int((anios.get(y) or {}).get(key, 0) or 0) for y in YEARS]

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    src = RAW / "institutions.json"
    if not src.exists():
        alt = Path("/tmp/oe-data/institutions.json")
        if alt.exists():
            src.write_bytes(alt.read_bytes())
        else:
            print("Descargando institutions.json…"); urllib.request.urlretrieve(SRC, src)
    inst = json.load(open(src, encoding="utf-8"))
    print(f"instituciones en origen: {len(inst):,}")

    index, by_region = [], {}
    tot_rep = 0
    for slug_i, v in inst.items():
        y = years_vec(v.get("anios", {}))
        t = int(v.get("total", 0) or 0)
        assert sum(y) == t, f"sum(y)!=total en {slug_i}"
        tot_rep += t
        servicios = [{"cm": s["cm"], "nivel": s.get("nivel"), "t": int(s.get("total", 0) or 0),
                      "matricula": s.get("matricula"), "tasa_2024": s.get("tasa_2024")}
                     for s in v.get("servicios", [])]
        row = {
            "s": slug_i, "ci": v.get("codinst"), "cm": v.get("cm"), "n": v.get("nombre"),
            "d": v.get("distrito"), "p": v.get("provincia"), "r": v.get("departamento"),
            "g": v.get("gestion"), "ugel": v.get("ugel"),
            "nv": v.get("niveles", []), "ns": len(servicios), "t": t, "y": y,
            "mat": v.get("matricula"), "mat_ok": bool(v.get("matricula_completa")),
            "tasa_2024": v.get("tasa_2024"),
        }
        index.append(row)
        det = dict(row); det["servicios"] = servicios
        det["tipos"] = {k: years_vec(v.get("anios", {}), k) for k in TIPOS}
        ctx = v.get("contexto") or {}
        det["contexto"] = {k: {"v": c.get("v"), "f": c.get("f"), "a": c.get("a")} for k, c in ctx.items() if isinstance(c, dict)}
        by_region.setdefault(slug(v.get("departamento")), []).append(det)

    index.sort(key=lambda r: (-r["t"], r["n"] or ""))
    meta = {
        "dataset": "Instituciones educativas (colegio completo) con sus servicios/niveles",
        "source": ("MINEDU — SíseVe microdato 2013–2026 (acceso a la información pública) + Padrón/Censo "
                   "Educativo 2024 (ESCALE) + Identicole; agrupación por codinst publicada por "
                   "fiorellatl/observatorio-violencia-escolar"),
        "retrieval_date": "2026-09-25", "years": [int(y) for y in YEARS],
        "n_instituciones": len(index), "total_reportes": tot_rep,
        "note": ("Una institución agrupa varios servicios (código modular = un nivel). Reportes y matrícula "
                 "se suman; la tasa 2024 (por 1,000) viene recalculada por la fuente y solo si todos los "
                 "servicios tienen matrícula (mat_ok). Registro administrativo, no prevalencia."),
        "rows": index,
    }
    (OUT / "institutions").mkdir(exist_ok=True)
    with open(OUT / "institutions_index.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, separators=(",", ":"))
    for rs, rows in by_region.items():
        with open(OUT / "institutions" / f"{rs}.json", "w", encoding="utf-8") as f:
            json.dump({r["s"]: r for r in rows}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"instituciones: {len(index):,} · reportes: {tot_rep:,} · regiones: {len(by_region)}")
    print(f"index: {os.path.getsize(OUT/'institutions_index.json')/1e6:.2f} MB")
    for rs in sorted(by_region): print(f"  {rs}: {len(by_region[rs]):,} inst, {os.path.getsize(OUT/'institutions'/(rs+'.json'))/1e3:.0f} KB")

if __name__ == "__main__":
    main()
