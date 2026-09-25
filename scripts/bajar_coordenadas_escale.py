#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordenadas y local (sede física) de cada servicio educativo, desde la API REST
pública del Padrón de IIEE de ESCALE (MINEDU), sin autenticación:

    https://escale.minedu.gob.pe/padron/rest/instituciones?ubigeo=<prefijo>&start=<n>
    Accept: application/json  · 50 ítems por página · ubigeo acepta prefijo (15 = Lima)

LISTA BLANCA. El payload trae datos personales de adultos (director, telefono,
email, promotor, rzsocial, nroruc). Solo estos campos tocan el disco:
    codMod, anexo, codlocal, codinst, nlatIE, nlongIE, estado
Nada más se guarda, ni en la caché.

Salida: data/processed/schools_geo.json
    {"cm": {"la": lat, "lo": lon, "cl": codlocal, "ci": codinst}}  solo para los
    22,569 códigos modulares con reportes SíseVe (schools_index.json). Sirve para
    el mapa de sedes por distrito: los servicios que comparten `cl` son una sede.

Uso:
    python3 scripts/bajar_coordenadas_escale.py            # todos los departamentos
    python3 scripts/bajar_coordenadas_escale.py 15 07      # solo Lima y Callao
Reanudable (caché por página en data/raw/escale/, git-ignored). Pausa entre
peticiones: es un servidor del Estado.
"""
import json, sys, time, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "raw" / "escale"
OUT = ROOT / "data" / "processed" / "schools_geo.json"
IDX = ROOT / "data" / "processed" / "schools_index.json"
BASE = "https://escale.minedu.gob.pe/padron/rest/instituciones"
DEPTOS = [f"{i:02d}" for i in range(1, 26)]
KEEP = ("codMod", "anexo", "codlocal", "codinst", "nlatIE", "nlongIE")
PAUSE = 0.35

def fetch(prefix, start, retries=4):
    url = f"{BASE}?ubigeo={prefix}&start={start}&campos=estadistica"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0 (observatorio-bullying-peru)"})
    for i in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.loads(r.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            time.sleep(2 * (i + 1))
            last = e
    raise RuntimeError(f"fallo {url}: {last}")

def filtrar(item):
    """Aplica la lista blanca ANTES de escribir nada."""
    o = {k: item.get(k) for k in KEEP}
    est = item.get("estado")
    o["estado"] = est.get("valor") if isinstance(est, dict) else est
    return o

def bajar_prefijo(prefix):
    CACHE.mkdir(parents=True, exist_ok=True)
    start, n = 0, 0
    while True:
        p = CACHE / f"{prefix}_{start:06d}.json"
        if p.exists():
            items = json.load(open(p, encoding="utf-8"))
        else:
            data = fetch(prefix, start)
            raw = data.get("items") or []
            if isinstance(raw, dict): raw = [raw]
            items = [filtrar(x) for x in raw]           # lista blanca aquí
            json.dump(items, open(p, "w", encoding="utf-8"), separators=(",", ":"))
            time.sleep(PAUSE)
        n += len(items)
        yield from items
        if len(items) < 50: break
        start += 50
    print(f"  {prefix}: {n:,} servicios ({start // 50 + 1} páginas)", flush=True)

def main(prefijos):
    wanted = {r["cm"] for r in json.load(open(IDX, encoding="utf-8"))}
    geo = json.load(open(OUT, encoding="utf-8")) if OUT.exists() else {}
    for pref in prefijos:
        for it in bajar_prefijo(pref):
            cm = (it.get("codMod") or "").zfill(7)
            if cm not in wanted: continue
            try: la, lo = float(it["nlatIE"]), float(it["nlongIE"])
            except (TypeError, ValueError): continue
            if not (-19 < la < 1 and -82 < lo < -68): continue      # fuera del Perú = basura
            prev = geo.get(cm)
            # si un código modular tiene varios anexos, quédate con el activo
            if prev and prev.get("act") and it.get("estado") != "Activo": continue
            geo[cm] = {"la": round(la, 5), "lo": round(lo, 5), "cl": it.get("codlocal"), "ci": it.get("codinst"), "act": it.get("estado") == "Activo"}
        json.dump(geo, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(f"  → schools_geo.json: {len(geo):,} de {len(wanted):,} colegios con coordenadas", flush=True)

if __name__ == "__main__":
    main(sys.argv[1:] or DEPTOS)
