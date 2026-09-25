#!/usr/bin/env python3
# CONTROL DE DIVULGACIÓN ESTADÍSTICA (25-09-2026, revisión psicología/ética + seguridad):
#   - `sexual` y `personal_ie` por colegio-año con valor 1–4 se publican como -1 (= "<5"),
#     para no permitir reidentificar a una víctima o a un docente en colegios pequeños
#     (Ley 29733 datos sensibles; CNA art. 6). Los totales anuales no cambian.
#   - Supresión complementaria: al suprimir `sexual` se suprimen también `fisica` y
#     `psicologica` ese año; al suprimir `personal_ie`, también `entre_escolares`
#     (si no, total − publicados recupera la celda). Ver scripts/privacy.py.
#   - En nivel Inicial no se publica ningún desglose por tipo (todo -1 si > 0).
#   La regla se aplica a schools_top y a los shards schools_detail/.
"""
Genera los datos de colegios v2 (con series por año y shards por región)
a partir del microdato SíseVe 2013–2026 consolidado por
fiorellatl/observatorio-violencia-escolar.

Entradas (se descargan si faltan):
  data/raw/observatorio-escolar/schools_index.json   (se vendoriza)
  data/raw/observatorio-escolar/schools_detail.json  (14 MB, en .gitignore)

Salidas:
  data/processed/schools_index.json            {s,n,cm,d,p,r,g,nv,t,y[14]}
  data/processed/schools_top.json              top 300 con tipos por año
  data/processed/schools_detail/<region>.json  slug -> {ugel,dre,y,tipos}
  data/processed/schools_detail/_index.json    índice de shards

Uso: python3 scripts/build_schools_v2.py
"""
import json
import os
import re
import sys
import unicodedata
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from privacy import suprimir_tipos, verificar  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR = os.path.join(ROOT, "data", "raw", "observatorio-escolar")
OUT_DIR = os.path.join(ROOT, "data", "processed")
SHARD_DIR = os.path.join(OUT_DIR, "schools_detail")

BASE_URL = (
    "https://raw.githubusercontent.com/fiorellatl/observatorio-violencia-escolar"
    "/main/data/public/"
)
FALLBACK_DIR = "/tmp/oe-data"  # copia local descargada previamente

YEARS = list(range(2013, 2027))  # 14 posiciones fijas
YEAR_KEYS = [str(y) for y in YEARS]
TIPOS = [
    "fisica",
    "psicologica",
    "sexual",
    "bullying",
    "ciberacoso",
    "entre_escolares",
    "personal_ie",
]
TOP_N = 300
EXPECTED_TOTAL = 122984
EXPECTED_N = 22569
RETRIEVAL_DATE = "2026-09-24"
COMPACT = dict(separators=(",", ":"), ensure_ascii=False)


def region_slug(name):
    """NFD, sin diacríticos, lowercase, [^a-z0-9] -> '-', colapsar, strip."""
    s = unicodedata.normalize("NFD", name)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def ensure_file(name):
    path = os.path.join(RAW_DIR, name)
    if os.path.exists(path):
        return path
    os.makedirs(RAW_DIR, exist_ok=True)
    fallback = os.path.join(FALLBACK_DIR, name)
    if os.path.exists(fallback):
        print(f"  copiando {fallback} -> {path}")
        with open(fallback, "rb") as src, open(path, "wb") as dst:
            dst.write(src.read())
        return path
    url = BASE_URL + name
    print(f"  descargando {url}")
    urllib.request.urlretrieve(url, path)
    return path


def series(anios, key):
    """[14 ints] con el valor de `key` por año 2013..2026 (ausente = 0)."""
    return [int((anios.get(y) or {}).get(key, 0) or 0) for y in YEAR_KEYS]


def tipos_series(anios, nivel=None):
    """Desglose por tipo con control de divulgación estadística (ver cabecera y
    scripts/privacy.py): sexual/personal_ie 1-4 -> -1 ("<5") más la partición
    complementaria; en Inicial todo desglose > 0 -> -1."""
    return suprimir_tipos({t: series(anios, t) for t in TIPOS}, nivel)


def dump(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, **COMPACT)
    return os.path.getsize(path)


def main():
    print("== Entradas")
    idx_path = ensure_file("schools_index.json")
    det_path = ensure_file("schools_detail.json")
    with open(idx_path, encoding="utf-8") as f:
        index = json.load(f)
    with open(det_path, encoding="utf-8") as f:
        detail = json.load(f)
    print(f"  index: {len(index)} colegios | detail: {len(detail)} colegios")

    anomalies = []

    # --- Consistencia index <-> detail
    idx_slugs = {r["s"] for r in index}
    det_slugs = set(detail)
    if idx_slugs != det_slugs:
        anomalies.append(
            f"slugs distintos: {len(idx_slugs - det_slugs)} solo en index, "
            f"{len(det_slugs - idx_slugs)} solo en detail"
        )
    if len(idx_slugs) != len(index):
        anomalies.append("slugs duplicados en index")

    # --- 1) schools_index.json con y[14]
    out_index = []
    bad_sum = 0
    for r in index:
        d = detail.get(r["s"])
        if d is None:
            anomalies.append(f"sin detail: {r['s']}")
            y = [0] * 14
        else:
            anios = d.get("anios") or {}
            extra_years = set(anios) - set(YEAR_KEYS)
            if extra_years:
                anomalies.append(f"{r['s']}: años fuera de rango {sorted(extra_years)}")
            y = series(anios, "total")
            if d.get("total") != r["t"]:
                anomalies.append(
                    f"{r['s']}: total index={r['t']} != detail={d.get('total')}"
                )
            if d.get("departamento") != r["r"]:
                anomalies.append(
                    f"{r['s']}: región index={r['r']!r} != detail={d.get('departamento')!r}"
                )
            for k_idx, k_det in (("n", "nombre"), ("d", "distrito"), ("p", "provincia"),
                                 ("g", "gestion"), ("nv", "nivel"), ("cm", "cm")):
                if r.get(k_idx) != d.get(k_det):
                    anomalies.append(
                        f"{r['s']}: {k_idx} index={r.get(k_idx)!r} != detail={d.get(k_det)!r}"
                    )
        if sum(y) != r["t"]:
            bad_sum += 1
            anomalies.append(f"{r['s']}: sum(y)={sum(y)} != t={r['t']}")
        out_index.append({
            "s": r["s"], "n": r["n"], "cm": r["cm"], "d": r["d"], "p": r["p"],
            "r": r["r"], "g": r["g"], "nv": r["nv"], "t": r["t"], "y": y,
        })

    total_t = sum(r["t"] for r in out_index)
    print("\n== Verificaciones")
    print(f"  colegios: {len(out_index)} (esperado {EXPECTED_N}) -> "
          f"{'OK' if len(out_index) == EXPECTED_N else 'FALLA'}")
    print(f"  sum(y)==t en todos: {'OK' if bad_sum == 0 else f'FALLA ({bad_sum})'}")
    print(f"  suma global t = {total_t} (esperado {EXPECTED_TOTAL}) -> "
          f"{'OK' if total_t == EXPECTED_TOTAL else 'FALLA'}")

    os.makedirs(OUT_DIR, exist_ok=True)
    size = dump(os.path.join(OUT_DIR, "schools_index.json"), out_index)
    print(f"\n== schools_index.json: {size:,} bytes")

    # --- 2) schools_top.json
    top = sorted(out_index, key=lambda r: (-r["t"], r["n"]))[:TOP_N]
    rows = []
    for r in top:
        d = detail[r["s"]]
        anios = d.get("anios") or {}
        rows.append({
            "s": r["s"], "n": r["n"], "cm": r["cm"], "d": r["d"], "p": r["p"],
            "r": r["r"], "g": r["g"], "nv": r["nv"], "ugel": d.get("ugel"),
            "t": r["t"], "y": r["y"], "tipos": tipos_series(anios, r["nv"]),
        })
    top_obj = {
        "dataset": "Top nacional de colegios por reportes SíseVe (microdato oficial)",
        "source": ("MINEDU — SíseVe, microdato 2013–2026 (acceso a la información "
                   "pública); consolidado de fiorellatl/observatorio-violencia-escolar"),
        "retrieval_date": RETRIEVAL_DATE,
        "years": YEARS,
        "n_total": len(out_index),
        "total_reportes": total_t,
        "rows": rows,
    }
    size = dump(os.path.join(OUT_DIR, "schools_top.json"), top_obj)
    print(f"== schools_top.json: {size:,} bytes ({len(rows)} filas)")

    # --- 3) shards por región
    os.makedirs(SHARD_DIR, exist_ok=True)
    by_region = {}
    region_names = {}
    for r in out_index:
        slug = region_slug(r["r"])
        if region_names.setdefault(slug, r["r"]) != r["r"]:
            anomalies.append(
                f"colisión de slug de región {slug}: {region_names[slug]!r} vs {r['r']!r}"
            )
        d = detail[r["s"]]
        tipos = tipos_series(d.get("anios") or {}, d.get("nivel"))
        for i, particion, sup in verificar(tipos):
            anomalies.append(
                f"{r['s']} {YEARS[i]}: supresión parcial {sup} en {particion} (recuperable)"
            )
        by_region.setdefault(slug, {})[r["s"]] = {
            "ugel": d.get("ugel"),
            "dre": d.get("dre"),
            "y": r["y"],
            "tipos": tipos,
        }

    # limpiar shards viejos que ya no correspondan
    for fn in os.listdir(SHARD_DIR):
        if fn.endswith(".json") and fn != "_index.json" and fn[:-5] not in by_region:
            os.remove(os.path.join(SHARD_DIR, fn))

    print(f"== schools_detail/ ({len(by_region)} shards)")
    shard_index = {}
    for slug in sorted(by_region):
        fn = f"{slug}.json"
        size = dump(os.path.join(SHARD_DIR, fn), by_region[slug])
        shard_index[slug] = {
            "nombre": region_names[slug],
            "n": len(by_region[slug]),
            "file": fn,
            "bytes": size,
        }
        print(f"  {fn:<22} {len(by_region[slug]):>6} colegios  {size:>10,} bytes")
    size = dump(os.path.join(SHARD_DIR, "_index.json"), {"regions": shard_index})
    print(f"  {'_index.json':<22} {'':>6}           {size:>10,} bytes")
    print(f"  shards: {len(by_region)} (esperado 25) -> "
          f"{'OK' if len(by_region) == 25 else 'FALLA'}")

    # --- Top 10
    print("\n== Top 10")
    for i, r in enumerate(rows[:10], 1):
        print(f"  {i:>2}. {r['n']} ({r['d']}, {r['r']}) — {r['t']}")

    # --- Anomalías
    print(f"\n== Anomalías: {len(anomalies)}")
    for a in anomalies[:50]:
        print("  -", a)
    if len(anomalies) > 50:
        print(f"  ... y {len(anomalies) - 50} más")

    ok = (bad_sum == 0 and total_t == EXPECTED_TOTAL and len(by_region) == 25)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
