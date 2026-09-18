#!/usr/bin/env python3
"""
build_indicators.py — Calcula indicadores (tasas por 10,000 estudiantes) a partir de
data/processed/by_department.json y data/processed/population.json, y escribe
data/processed/indicators.json.

Regla: no inventar datos. Un departamento sin reportes publicados queda sin tasa (null),
no en 0. Las tasas usan matrícula TOTAL (todos los niveles).
"""
import json
import os
import unicodedata
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, "data", "processed", *a)


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").upper()
    return s.replace("PROV. CONST. DEL ", "").replace("REGION LIMA", "LIMA PROVINCIA").strip()


def load(name):
    with open(P(name), encoding="utf-8") as f:
        return json.load(f)


def main():
    bydep = load("by_department.json")
    pop = load("population.json")
    popmap = {norm(d["department"]): d["students"] for d in pop["data"]}

    out = {"dataset": "Indicadores (tasa por 10,000 estudiantes)",
           "generated_at": date.today().isoformat(),
           "population_year": pop["year"], "by_year": {}}

    for year, deps in bydep.items():
        if not isinstance(deps, dict):
            continue
        rows = []
        for dep, v in deps.items():
            cases = v.get("cases")
            students = popmap.get(norm(dep))
            rate = round(cases / students * 10000, 2) if (students and cases is not None) else None
            rows.append({"department": dep, "cases": cases, "students": students, "rate_per_10k": rate})
        rows.sort(key=lambda r: (r["rate_per_10k"] or -1), reverse=True)
        out["by_year"][year] = rows

    with open(P("indicators.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("Escrito data/processed/indicators.json")
    for year, rows in out["by_year"].items():
        top = next((r for r in rows if r["rate_per_10k"] is not None), None)
        if top:
            print(f"  {year}: mayor tasa → {top['department']} = {top['rate_per_10k']} /10k")


if __name__ == "__main__":
    main()
