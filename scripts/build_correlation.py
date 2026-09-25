#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Correlaciones por colegio calculadas POR NOSOTROS desde el microdato por servicio
educativo (data/processed/schools_detail/<region>.json), no copiadas de terceros.

Hallazgo de la revisión de datos (25-09-2026): el `correlacion.json` de la fuente
mide "entre escolares × personal de la IE" por institución, no "física × psicológica".
Aquí se calculan ambos pares, declarando la unidad (servicio = código modular).

Salida: data/processed/correlation.json
  {"unidad":"servicio educativo (código modular)","anios":[...],"anio_parcial":"2026",
   "pares":{"fisica_psicologica":{"x":"Física","y":"Psicológica","datos":{año:{puntos:[[x,y,n]],r,colegios,ambos}}},
            "escolares_personal":{...}}}
Solo entran servicios con ≥1 reporte de alguno de los dos tipos del par en el año (los (0,0) no entran: inflarían r). r = Pearson sobre los servicios
(no sobre los puntos agrupados). Sin datos personales: son conteos por colegio, y los
puntos agrupan colegios (no se identifica ninguno).
"""
import json, glob, math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed" / "correlation.json"
YEARS = list(range(2013, 2027))
ANIOS = ["2022", "2023", "2024", "2025", "2026"]      # años lectivos con presencialidad (+2026 parcial)
PARES = {
    "fisica_psicologica": ("fisica", "psicologica", "Física", "Psicológica"),
    "escolares_personal": ("entre_escolares", "personal_ie", "Entre escolares", "De personal de la IE"),
}

def pearson(xs, ys):
    n = len(xs)
    if n < 3: return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs); syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0: return None
    return round(sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / math.sqrt(sxx * syy), 4)

RAW = ROOT / "data" / "raw" / "observatorio-escolar" / "schools_detail.json"
SRC = "https://raw.githubusercontent.com/fiorellatl/observatorio-violencia-escolar/main/data/public/schools_detail.json"

def load_rows():
    """Lee el detalle por servicio SIN supresión (data/raw, git-ignored): la correlación es un
    agregado y no plantea riesgo de divulgación; los shards públicos llevan -1 en Inicial y en
    sexual/personal_ie < 5, lo que sesgaría el cálculo. Descarga la fuente si falta."""
    if not RAW.exists():
        import urllib.request; RAW.parent.mkdir(parents=True, exist_ok=True)
        print("Descargando schools_detail.json…"); urllib.request.urlretrieve(SRC, RAW)
    det = json.load(open(RAW, encoding="utf-8"))
    rows = []
    for slug, v in det.items():
        an = v.get("anios") or {}
        tipos = {k: [int((an.get(str(y)) or {}).get(k, 0) or 0) for y in YEARS] for k in ("fisica", "psicologica", "sexual", "entre_escolares", "personal_ie")}
        rows.append({"tipos": tipos})
    return rows

def main():
    rows = load_rows()
    print(f"servicios: {len(rows):,} (fuente sin supresión)")
    out = {"dataset": "Correlación entre tipos de reporte por colegio (cálculo propio desde el microdato SíseVe)",
           "source": ("MINEDU — SíseVe, microdato 2013–2026 (acceso a la información pública); capa por colegio "
                      "consolidada por fiorellatl/observatorio-violencia-escolar; correlaciones calculadas por este observatorio"),
           "retrieval_date": "2026-09-25", "unidad": "servicio educativo (código modular)",
           "note": ("Cada punto agrupa colegios (servicios) con la misma combinación (x, y); el tamaño es cuántos. "
                    "r = Pearson sobre los servicios con al menos un reporte de alguno de los dos tipos del par en el año (sin pares (0,0)). Los valores -1 "
                    "(celdas suprimidas <5) no afectan a estos pares porque física/psicológica/entre escolares no se "
                    "suprimen; personal_ie suprimido se toma como 0 (sesgo a la baja declarado)."),
           "anios": ANIOS, "anio_parcial": "2026", "pares": {}}
    for key, (kx, ky, lx, ly) in PARES.items():
        datos = {}
        for a in ANIOS:
            i = YEARS.index(int(a))
            xs, ys = [], []
            for r in rows:
                x = (r["tipos"].get(kx) or [0] * 14)[i]; y = (r["tipos"].get(ky) or [0] * 14)[i]
                if x + y == 0: continue          # solo servicios con ≥1 reporte de alguno de los dos tipos del par
                xs.append(x); ys.append(y)
            c = Counter(zip(xs, ys))
            datos[a] = {"puntos": sorted([[x, y, n] for (x, y), n in c.items()], key=lambda p: -p[2]),
                        "r": pearson(xs, ys), "colegios": len(xs),
                        "ambos": sum(1 for x, y in zip(xs, ys) if x > 0 and y > 0),
                        "solo_x": sum(1 for x, y in zip(xs, ys) if x > 0 and y == 0),
                        "solo_y": sum(1 for x, y in zip(xs, ys) if x == 0 and y > 0)}
        out["pares"][key] = {"x": lx, "y": ly, "datos": datos}
        print("  " + key + ": " + ", ".join(f"{a} r={datos[a]['r']} n={datos[a]['colegios']} ambos={datos[a]['ambos']}" for a in ANIOS))
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"→ {OUT.relative_to(ROOT)} {OUT.stat().st_size/1e3:.0f} KB")

if __name__ == "__main__":
    main()
