#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrícula y tasa 2024 por servicio educativo (código modular), para mostrar la tasa
por 1,000 estudiantes AL LADO del conteo en el listado de colegios (revisión UI/ética
25-09-2026: un conteo sin denominador se lee como ranking).

Entrada: data/raw/observatorio-escolar/cross_2024.json (13,616 servicios con matrícula
Censo 2024, reportes 2024 y tasa; capa pública de fiorellatl). Sin datos personales.
Salida: data/processed/schools_matricula_2024.json  {"cm": [matricula, tasa_x1000]}
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "observatorio-escolar" / "cross_2024.json"
OUT = ROOT / "data" / "processed" / "schools_matricula_2024.json"

def main():
    rows = json.load(open(RAW, encoding="utf-8"))
    out = {}
    for r in rows:
        cm = r["slug"].rsplit("-", 1)[-1].zfill(7)
        if r.get("matricula"):
            out[cm] = [int(r["matricula"]), r.get("tasa")]
    meta = {"dataset": "Matrícula 2024 y tasa de reportes por 1,000 por servicio educativo",
            "source": "Padrón/Censo Educativo 2024 (ESCALE) + microdato SíseVe 2024; consolidado de fiorellatl/observatorio-violencia-escolar (cross_2024.json)",
            "retrieval_date": "2026-09-25", "anio": 2024, "n": len(out), "data": out}
    json.dump(meta, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"servicios con matrícula 2024: {len(out):,} → {OUT.stat().st_size/1e3:.0f} KB")

if __name__ == "__main__":
    main()
