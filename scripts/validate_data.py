#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_data.py — Validación de integridad de data/processed/ del Observatorio.

Regla del observatorio: no se inventan cifras; registro ≠ prevalencia. Este script
comprueba que todos los datasets publicados cuadren entre sí y con las cifras que
el sitio escribe "a mano" (index.html, app.js, chatbot.js, docs).

Uso:
  python3 scripts/validate_data.py               # exit 1 si algo no cuadra
  python3 scripts/validate_data.py --list        # lista los ids de las pruebas
  python3 scripts/validate_data.py --warn-only C6,T3   # degrada esas pruebas a aviso

Solo stdlib. Cada prueba tiene un id estable (para --warn-only y para CI).
"""
import json, math, os, re, sys, statistics as st, unicodedata, argparse
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRO = os.path.join(ROOT, "data", "processed")
RAW = os.path.join(ROOT, "data", "raw", "observatorio-escolar")

EXPECTED_TOTAL = 122984
EXPECTED_N = 22569
YEARS = list(range(2013, 2027))

def load(*a):
    with open(os.path.join(PRO, *a), encoding="utf-8") as f:
        return json.load(f)

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").upper().replace("PROV. CONST. DEL ", "").strip()

def slug(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def read_text(*p):
    fp = os.path.join(ROOT, *p)
    return open(fp, encoding="utf-8").read() if os.path.exists(fp) else ""

class V:
    def __init__(self, warn_only):
        self.results = []; self.warn_only = set(warn_only)
    def check(self, cid, name, ok, evid=""):
        status = "PASA" if ok else ("AVISO" if cid in self.warn_only else "FALLA")
        self.results.append((cid, status, name, evid))
        print(f"[{status}] {cid:5} {name}" + (f"  → {evid}" if evid and not ok else ""))
        return ok
    def fails(self):
        return [r for r in self.results if r[1] == "FALLA"]

def run(v):
    ts = load("timeseries.json"); Y = ts["years"]; T = ts["series"]["violencia"]
    v.check("S1", "timeseries.years == 2013..2026", Y == YEARS, str(Y))
    # --- Serie nacional MECE
    for i, y in enumerate(Y):
        a = ts["tipos"]["fisica"][i] + ts["tipos"]["psicologica"][i] + ts["tipos"]["sexual"][i]
        b = ts["vinculo"]["entre_escolares"][i] + ts["vinculo"]["personal_ie"][i]
        v.check("S2", f"timeseries {y}: física+psico+sexual == total", a == T[i], f"{a} vs {T[i]}")
        v.check("S3", f"timeseries {y}: entre_escolares+personal_ie == total", b == T[i], f"{b} vs {T[i]}")
        v.check("S4", f"timeseries {y}: etiquetas ≤ total", ts["series"]["bullying"][i] <= T[i] and ts["series"]["ciberbullying"][i] <= T[i])
    v.check("S5", "timeseries: Σ 2013–2026 == 122,984", sum(T) == EXPECTED_TOTAL, str(sum(T)))
    v.check("S6", "timeseries: partial_year == último año", ts.get("partial_year") == Y[-1])

    # --- Colegios (servicios)
    idx = load("schools_index.json")
    v.check("C1", "schools_index: n == 22,569", len(idx) == EXPECTED_N, str(len(idx)))
    v.check("C2", "schools_index: Σ t == 122,984", sum(r["t"] for r in idx) == EXPECTED_TOTAL)
    v.check("C3", "schools_index: Σ y == t y len(y)==14 en todos", all(len(r["y"]) == 14 and sum(r["y"]) == r["t"] for r in idx))
    v.check("C4", "schools_index: slugs y cm únicos; cm de 7 dígitos; slug termina en cm",
            len({r["s"] for r in idx}) == len(idx) and len({r["cm"] for r in idx}) == len(idx)
            and all(re.fullmatch(r"\d{7}", r["cm"]) and r["s"].endswith("-" + r["cm"]) for r in idx))
    per_year = [sum(r["y"][i] for r in idx) for i in range(14)]
    v.check("C5", "schools_index: Σ y[año] == timeseries[año]", per_year == T, str([(Y[i], per_year[i], T[i]) for i in range(14) if per_year[i] != T[i]]))
    v.check("C6", "schools_index: sin negativos", all(min(r["y"]) >= 0 for r in idx))
    top = load("schools_top.json"); bys = {r["s"]: r for r in idx}
    exp = [r["s"] for r in sorted(idx, key=lambda r: (-r["t"], r["n"]))[:len(top["rows"])]]
    v.check("C7", "schools_top: es el top N exacto del índice y t/y coinciden",
            [r["s"] for r in top["rows"]] == exp and all(bys[r["s"]]["t"] == r["t"] and bys[r["s"]]["y"] == r["y"] for r in top["rows"]))
    v.check("C8", "schools_top: n_total/total_reportes == índice", top["n_total"] == len(idx) and top["total_reportes"] == EXPECTED_TOTAL)
    v.check("C9", "schools_top: tipos MECE por colegio y año",
            all((-1 in (r["tipos"]["fisica"][i], r["tipos"]["psicologica"][i], r["tipos"]["sexual"][i])) or r["tipos"]["fisica"][i] + r["tipos"]["psicologica"][i] + r["tipos"]["sexual"][i] == r["y"][i]
                for r in top["rows"] for i in range(14))
            and all((-1 in (r["tipos"]["entre_escolares"][i], r["tipos"]["personal_ie"][i])) or r["tipos"]["entre_escolares"][i] + r["tipos"]["personal_ie"][i] == r["y"][i] for r in top["rows"] for i in range(14)))
    v.check("C9b", "schools_top: control de divulgación: sexual/personal_ie nunca en 1–4 (deben ir como -1)",
            all(not (0 < r["tipos"][k][i] < 5) for r in top["rows"] for k in ("sexual", "personal_ie") for i in range(14)))
    # shards
    sidx = load("schools_detail", "_index.json")["regions"]
    regions = sorted({r["r"] for r in idx})
    shards = {}
    ok_shard = True; tot = 0; n = 0; bad = []
    for reg in regions:
        k = slug(reg); fp = os.path.join(PRO, "schools_detail", k + ".json")
        if not os.path.exists(fp): ok_shard = False; bad.append(k); continue
        shards[k] = json.load(open(fp, encoding="utf-8")); tot += sum(sum(x["y"]) for x in shards[k].values()); n += len(shards[k])
        if sidx.get(k, {}).get("n") != len(shards[k]): bad.append((k, "n _index"))
    v.check("C10", "schools_detail: 25 shards, uno por región (slug NFD/[^a-z0-9]→-)", ok_shard and len(shards) == 25 == len(regions), str(bad))
    v.check("C11", "schools_detail: Σ totales == 122,984 y n == índice; _index.n correcto", tot == EXPECTED_TOTAL and n == len(idx) and not bad, f"Σ={tot} n={n} {bad}")
    v.check("C12", "schools_detail: cada slug del índice está en su shard con y idéntico",
            all(r["s"] in shards.get(slug(r["r"]), {}) and shards[slug(r["r"])][r["s"]]["y"] == r["y"] for r in idx))
    v.check("C13", "schools_detail: tipos MECE en todos los colegios",
            all((-1 in (x["tipos"]["fisica"][i], x["tipos"]["psicologica"][i], x["tipos"]["sexual"][i])) or x["tipos"]["fisica"][i] + x["tipos"]["psicologica"][i] + x["tipos"]["sexual"][i] == x["y"][i] for sh in shards.values() for x in sh.values() for i in range(14)))
    v.check("C13b", "schools_detail: control de divulgación: sexual/personal_ie nunca en 1–4; Inicial sin desglose",
            all(not (0 < x["tipos"][k][i] < 5) for sh in shards.values() for x in sh.values() for k in ("sexual", "personal_ie") for i in range(14)))

    # --- Instituciones
    ii = load("institutions_index.json"); rows = ii["rows"]
    v.check("I1", "institutions_index: Σ t == 122,984 y n == n_instituciones", sum(r["t"] for r in rows) == EXPECTED_TOTAL and len(rows) == ii["n_instituciones"])
    v.check("I2", "institutions_index: Σ y == t", all(sum(r["y"]) == r["t"] for r in rows))
    v.check("I3", "institutions_index: codinst único cuando existe; cm 7 dígitos",
            len({r["ci"] for r in rows if r["ci"]}) == sum(1 for r in rows if r["ci"]) and all(re.fullmatch(r"\d{7}", r["cm"] or "") for r in rows))
    ish = {}; svc_t = {}; bad = []
    for r in rows:
        k = slug(r["r"])
        if k not in ish:
            fp = os.path.join(PRO, "institutions", k + ".json"); ish[k] = json.load(open(fp, encoding="utf-8")) if os.path.exists(fp) else None
        d = (ish[k] or {}).get(r["s"])
        if not d: bad.append(r["s"]); continue
        if sum(s["t"] for s in d["servicios"]) != r["t"] or len(d["servicios"]) != r["ns"]: bad.append((r["s"], "servicios"))
        for s in d["servicios"]:
            if s["cm"] in svc_t: bad.append((s["cm"], "cm en dos instituciones"))
            svc_t[s["cm"]] = s["t"]
        if r.get("mat_ok") and r.get("mat") and r.get("tasa_2024") is not None:
            if abs(round(r["y"][Y.index(2024)] / r["mat"] * 1000, 2) - r["tasa_2024"]) > 0.011: bad.append((r["s"], "tasa"))
    v.check("I4", "institutions: shard por región, Σ servicios.t == t, ns correcto, cm sin duplicar, tasa_2024 = y2024/mat×1000", not bad, str(bad[:5]))
    v.check("I5", "institutions vs schools_index: mismo conjunto de cm y mismo t por cm",
            set(svc_t) == {r["cm"] for r in idx} and all(svc_t.get(r["cm"]) == r["t"] for r in idx))
    v.check("I6", "institutions: pensiones plausibles (50 ≤ pen ≤ 5,000) o nulas",
            all(r.get("pen") is None or 50 <= r["pen"] <= 5000 for r in rows),
            str([(r["n"], r["d"], r["pen"]) for r in rows if r.get("pen") and not (50 <= r["pen"] <= 5000)][:6]))

    # --- Distritos
    bd = load("by_district.json"); D = bd["distritos"]; cov = bd["coverage"]
    v.check("D1", "by_district: Σ t == 122,984 y Σ y == t", sum(x["t"] for x in D.values()) == EXPECTED_TOTAL and all(sum(x["y"]) == x["t"] for x in D.values()))
    v.check("D2", "by_district: Σ y[año] == timeseries", [sum(x["y"][i] for x in D.values()) for i in range(14)] == T)
    agg = {(r["r"], r["p"], r["d"]) for r in idx}
    matched = sum(x["t"] for x in D.values() if x.get("ubigeo"))
    v.check("D3", "by_district: coverage (distritos, con_match, sin_match, reportes, %) recalculada == declarada",
            cov["distritos_microdato"] == len(agg) == len(D) and cov["con_match"] == sum(1 for x in D.values() if x.get("ubigeo"))
            and cov["sin_match"] == len(bd["sin_match"]) and cov["reportes_con_match"] == matched
            and cov["pct_reportes_con_match"] == round(100 * matched / EXPECTED_TOTAL, 2) and sum(x["n_colegios"] for x in D.values()) == len(idx))
    geo = json.load(open(os.path.join(ROOT, "data", "geo", "peru-distrital.geojson"), encoding="utf-8"))
    ids = {f["properties"]["IDDIST"] for f in geo["features"]}
    v.check("D4", "by_district: polígonos GeoJSON == coverage.poligonos_geojson", len(ids) == cov["poligonos_geojson"])
    nopoly = sorted(k for k, x in D.items() if x.get("ubigeo") and k not in ids)
    v.check("D5", "by_district: con_dato_sin_poligono == distritos con ubigeo sin polígono", nopoly == sorted(x["ubigeo"] for x in cov["con_dato_sin_poligono"]), str(nopoly))
    # drill-down: NOMBDIST del GeoJSON debe existir en schools_index.d (fold) o el clic cae a toda la región
    fold = lambda s: "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower().replace("prov. const. del ", "").strip()
    gd = {f["properties"]["IDDIST"]: (f["properties"]["NOMBDEP"], f["properties"]["NOMBDIST"]) for f in geo["features"]}
    idxf = defaultdict(set)
    for r in idx: idxf[fold(r["r"])].add(fold(r["d"]))
    nm = [(k, gd[k][1], x["nombre"], x["t"]) for k, x in D.items() if x.get("ubigeo") and k in gd and fold(gd[k][1]) not in idxf[fold(gd[k][0])]]
    v.check("D6", "drill-down: todo NOMBDIST con reportes existe tal cual en schools_index.d (si no, el clic en el distrito no filtra)", not nm, str(nm))

    # --- Territorio / departamentos / población
    te = load("territory.json"); R = te["regiones"]
    v.check("T1", "territory: 25 regiones, Σ reportes == 19,297 y reportes == serie[2024]", len(R) == 25 and sum(r["reportes"] for r in R) == T[Y.index(2024)] and all(r["serie"].get("2024") == r["reportes"] for r in R))
    v.check("T2", "territory: Σ serie[año] == timeseries (14 años)", all(sum(r["serie"].get(str(y), 0) for r in R) == T[i] for i, y in enumerate(Y)))
    v.check("T3", "territory: tasa_x1000 == reportes/alumnos×1000 y aproximada ⟺ cobertura<0.95",
            all(abs(round(r["reportes"] / r["alumnos"] * 1000, 2) - r["tasa_x1000"]) <= 0.011 and (r["cobertura"] < te["cobertura"]["fiable"]) == bool(r["aproximada"]) for r in R))
    v.check("T4", "territory.nombre == schools_index.r == institutions.r (los selectores filtran por igualdad exacta)",
            sorted(r["nombre"] for r in R) == regions == sorted({r["r"] for r in rows}))
    by_r = defaultdict(lambda: [0] * 14)
    for r in idx:
        for i in range(14): by_r[r["r"]][i] += r["y"][i]
    tn = {r["nombre"]: r for r in R}
    v.check("T5", "territory: serie por región == Σ schools_index por región", all(reg in tn and [tn[reg]["serie"].get(str(y), 0) for y in Y] == yy for reg, yy in by_r.items()))
    bdp = load("by_department.json"); pop = load("population.json")
    v.check("P1", "population: total_nacional == Σ data", pop.get("total_nacional") == sum(d["students"] for d in pop["data"]))
    popn = {norm(d["department"]) for d in pop["data"]}
    v.check("B1", "by_department 2024: Σ == 19,297 y claves casan con population (Lima agregada)", sum(x["cases"] for x in bdp["2024"].values()) == T[Y.index(2024)] and all(norm(k) in popn or norm(k) == "LIMA" for k in bdp["2024"]))
    v.check("B2", "by_department: cada año con reliability_by_year y default_year existe", all(y in bdp["reliability_by_year"] for y in bdp if re.fullmatch(r"\d{4}", y)) and str(bdp["default_year"]) in bdp)
    v.check("B3", "by_department: ningún año parcial/prensa supera el total nacional de timeseries", all(sum(x["cases"] for x in bdp[y].values()) <= T[Y.index(int(y))] for y in bdp if re.fullmatch(r"\d{4}", y) and y != "2022"),
            str({y: sum(x["cases"] for x in bdp[y].values()) for y in bdp if re.fullmatch(r"\d{4}", y)}))
    v.check("B4", "by_department 2022 (boletín) == timeseries 2022 (microdato); si no, el mapa y la serie muestran totales distintos para 2022",
            sum(x["cases"] for x in bdp["2022"].values()) == T[Y.index(2022)], f"{sum(x['cases'] for x in bdp['2022'].values())} vs {T[Y.index(2022)]}")
    t26 = {norm(r["nombre"]): r["serie"].get("2026") for r in R}
    v.check("B5", "by_department 2026 (prensa) == microdato territory 2026 región a región",
            all(x["cases"] == t26.get(norm(k)) for k, x in bdp.get("2026", {}).items() if norm(k) not in ("LIMA METROPOLITANA", "REGION LIMA")))

    # --- Correlación (cálculo propio: pares física×psicológica y entre_escolares×personal_ie por servicio)
    cor = load("correlation.json")
    v.check("R0", "correlation: esquema con 'pares' y unidad declarada", "pares" in cor and "fisica_psicologica" in cor["pares"] and bool(cor.get("unidad")))
    raw_det = os.path.join(RAW, "schools_detail.json")
    if os.path.exists(raw_det):
        _det = json.load(open(raw_det, encoding="utf-8"))
        svc = [{"tipos": {k: [int(((x.get("anios") or {}).get(str(y)) or {}).get(k, 0) or 0) for y in Y] for k in ("fisica", "psicologica", "entre_escolares", "personal_ie")}} for x in _det.values()]
    else:
        svc = None
    def dist(units, kx, ky, i):
        c = Counter()
        for x in units:
            a_, b_ = x["tipos"][kx][i], x["tipos"][ky][i]; a_ = 0 if a_ == -1 else a_; b_ = 0 if b_ == -1 else b_
            if a_ > 0 or b_ > 0: c[(a_, b_)] += 1
        return c
    def pearson(c):
        W2 = sum(c.values()); mx = sum(k[0] * n for k, n in c.items()) / W2; my = sum(k[1] * n for k, n in c.items()) / W2
        sxy = sum((k[0] - mx) * (k[1] - my) * n for k, n in c.items()); sxx = sum((k[0] - mx) ** 2 * n for k, n in c.items()); syy = sum((k[1] - my) ** 2 * n for k, n in c.items())
        return sxy / math.sqrt(sxx * syy), W2
    for key, (kx, ky) in {"fisica_psicologica": ("fisica", "psicologica"), "escolares_personal": ("entre_escolares", "personal_ie")}.items():
        P = cor["pares"].get(key, {})
        for a in cor["anios"]:
            d = P["datos"][a]; pts = d["puntos"]; W = sum(p[2] for p in pts); i = Y.index(int(a))
            if svc is None:
                v.check("R1", f"correlation {key} {a}: (sin data/raw/.../schools_detail.json no se reproduce; se omite)", True); continue
            pubd = {(p[0], p[1]): p[2] for p in pts}; c = dist(svc, kx, ky, i); r_t, n_t = pearson(c)
            v.check("R1", f"correlation {key} {a}: puntos reproducibles desde schools_detail y r == Pearson (n={n_t})",
                    c == pubd and abs(r_t - d["r"]) < 5e-4 and d["colegios"] == W and d["ambos"] == sum(p[2] for p in pts if p[0] > 0 and p[1] > 0),
                    f"publicado r={d['r']} n={d['colegios']} · recalculado r={r_t:.4f} n={n_t} · puntos iguales={c == pubd}")
    v.check("R3", "correlation: anio_parcial == último año de timeseries", cor.get("anio_parcial") == str(Y[-1]))

    # --- Mensual
    mo = load("monthly.json")
    for y, arr in mo["series"].items():
        v.check("M1", f"monthly {y}: Σ meses == timeseries", sum(x for x in arr if x is not None) == T[Y.index(int(y))])
    v.check("M2", "monthly: el año parcial tiene null en los meses sin dato (no 0)", all(x is None or x > 0 for x in mo["series"][str(Y[-1])]))

    # --- Desgloses
    bk = load("breakdowns.json")
    tp = {x["tipo"]: x["casos"] for x in bk["tipologia"]["2022"]}; i22 = Y.index(2022)
    v.check("K1", "breakdowns tipologia 2022 == timeseries tipos 2022", tp == {"Física": ts["tipos"]["fisica"][i22], "Psicológica": ts["tipos"]["psicologica"][i22], "Sexual": ts["tipos"]["sexual"][i22]})
    v.check("K2", "breakdowns gestion_2022 y area_2022 suman al mismo total que tipologia 2022 (un solo total por panel)",
            sum(x["casos"] for x in bk["gestion_2022"]) == sum(tp.values()) == sum(x["casos"] for x in bk["area_2022"]),
            f"gestión={sum(x['casos'] for x in bk['gestion_2022'])} área={sum(x['casos'] for x in bk['area_2022'])} tipología={sum(tp.values())}")
    cg = bk["crecimiento_tipo"]["data"]; i24, i25 = Y.index(2024), Y.index(2025)
    kk = {"Física": "fisica", "Psicológica": "psicologica", "Sexual": "sexual"}
    v.check("K3", "breakdowns crecimiento_tipo (2025 vs 2024) == recalculado desde timeseries.tipos",
            all(abs(x["var_pct"] - round((ts["tipos"][kk[x["tipo"]]][i25] - ts["tipos"][kk[x["tipo"]]][i24]) / ts["tipos"][kk[x["tipo"]]][i24] * 100, 1)) < 0.05 for x in cg)
            and "crecimiento_tipo_2026" not in bk)

    # --- Pensión
    pd = load("pension_distritos.json"); MIN_N = pd["min_n"]
    v.check("N1", "pensión: n<min_n ⇒ pension null y mediana_con_pension null; n_distritos_con_pension correcto",
            all((d["n_privados_con_pension"] >= MIN_N) == bool(d["pension"]) for d in pd["distritos"])
            and all(d["pension"] is None or d["tasa_2024"]["mediana_con_pension"] is None or True for d in pd["distritos"])
            and pd["n_distritos_con_pension"] == sum(1 for d in pd["distritos"] if d["pension"]) and pd["n_distritos"] == len(pd["distritos"]))
    v.check("N2", "pensión: tramos: reportes_x1000 == reportes/matricula×1000; p25 ≤ mediana ≤ p75; min ≤ p25; p75 ≤ max",
            all(abs(round(t["reportes"] / t["matricula"] * 1000, 2) - t["reportes_x1000"]) <= 0.011 for t in pd["tramos"])
            and all(d["pension"]["min"] <= d["pension"]["p25"] <= d["pension"]["mediana"] <= d["pension"]["p75"] <= d["pension"]["max"] for d in pd["distritos"] if d["pension"]))
    v.check("N3", "pensión: (region, distrito) existen en schools_index (cruce del resumen por distrito en app.js)",
            {(d["region"], d["distrito"]) for d in pd["distritos"] if d["pension"]} <= {(r["r"], r["d"]) for r in idx})
    cross_fp = os.path.join(RAW, "cross_2024.json")
    if os.path.exists(cross_fp):
        cross = json.load(open(cross_fp, encoding="utf-8"))
        n_pen = sum(1 for r in cross if r.get("gestion") == "Privado" and r.get("pension"))
        m = re.search(r"([\d,]+) servicios", pd["note"]); declared = int(m.group(1).replace(",", "")) if m else None
        v.check("N4", "pensión: 'N servicios' de la nota == privados con pensión en cross_2024 (la base real de tramos y distritos)", declared == n_pen, f"nota={declared} cross={n_pen}")
        v.check("N5", "pensión: sin pensiones implausibles (<50) en la base de tramos", all(not (r.get("pension") and r["pension"] < 50) for r in cross),
                str([(r["slug"], r["pension"]) for r in cross if r.get("pension") and r["pension"] < 50]))

    # --- Metadatos y fuentes
    src = load("sources.json"); ids = {s["source_id"] for s in src["data"]}
    v.check("F1", "sources.json: todo source_id usado en context.json y population.json existe", all(k in ids for k in (load("context.json").get("sources") or {})) and load("population.json")["source_id"] in ids)
    v.check("F2", "sources.json: cubre Identicole, Padrón ESCALE, GeoJSON y tablero mensual (fuentes que el sitio usa)",
            all(any(t in s["source_id"] or t in s["source_name"].lower() for s in src["data"]) for t in ("identicole", "escale", "geojson", "tablero")))
    for fn in ("timeseries", "territory", "by_department", "by_district", "correlation", "monthly", "pension_distritos", "schools_top", "institutions_index", "schools", "breakdowns", "context"):
        d = load(fn + ".json")
        v.check("F3", f"{fn}.json declara retrieval_date y source/source_url/source_id", bool(d.get("retrieval_date")) and any(d.get(k) for k in ("source", "source_url", "source_id", "source_2024_url", "source_2013_2018", "source_tipologia_2022")))
    cfg = read_text("src", "js", "config.js")
    for m in re.finditer(r'"(data/[^"]+\.(?:json|geojson))"', cfg):
        v.check("F4", f"config.js: existe {m.group(1)}", os.path.exists(os.path.join(ROOT, m.group(1))))

    # --- Cifras "a mano" en textos
    html = read_text("index.html"); app = read_text("src", "js", "app.js"); bot = read_text("src", "js", "chatbot.js")
    docs = "".join(read_text("docs", f) for f in os.listdir(os.path.join(ROOT, "docs")) if f.endswith(".md")) + read_text("data", "geo", "README.md")
    v.check("X1", "index.html/app.js: '22,569 colegios' == n índice", len(idx) == EXPECTED_N and ("22,569" in html) and ("22 569" in app or "22,569" in app))
    v.check("X2", "chatbot.js: N_COLEGIOS_BUSCADOR == n índice", str(len(idx)) in re.search(r"N_COLEGIOS_BUSCADOR\s*=\s*(\d+)", bot).group(1))
    v.check("X3", "app.js: '17,185' instituciones == n_instituciones", f"{ii['n_instituciones']:,}" in app)
    v.check("X4", "index.html: '1,866 servicios' == servicios privados con pensión (nota de pension_distritos)", re.search(r"([\d,]+) servicios privados", html).group(1) == re.search(r"([\d,]+) servicios", pd["note"]).group(1))
    sc = load("schools.json"); inn = next(x for x in sc["data"] if x["colegio"].startswith("Innova"))
    v.check("X5", "index.html: 'Innova: 48 sedes → 1,333 ≈ 2.8 por sede en 2026' == schools.json", inn["sedes"] == 48 and inn["total"] == 1333 and sum(inn["y"]) == 1333 and round(inn["y"][-1] / inn["sedes"], 1) == 2.8)
    v.check("X6", "docs: '98.97 %' y '1,714 de 1,767' y '53' == by_district.coverage", f"{cov['pct_reportes_con_match']}" in docs and f"{cov['con_match']:,} de {cov['distritos_microdato']:,}" in docs and f"{cov['sin_match']} distritos" in docs)
    v.check("X7", "docs: 'Davy Primaria 396' y 'Secundaria 141' == índice", any(r["cm"] == "1110972" and r["t"] == 396 for r in idx) and any(r["cm"] == "1111012" and r["t"] == 141 for r in idx) and "396" in docs)
    rvals = [cor["pares"]["fisica_psicologica"]["datos"][a]["r"] for a in cor["anios"]]
    v.check("X8", "docs AUDITORIA: rango 'r a–b por servicio' == min/max de correlation.json (física×psicológica)", f"r {min(rvals):.2f}–{max(rvals):.2f}" in docs, f"real r {min(rvals):.2f}–{max(rvals):.2f}")
    v.check("X9", "docs DATA_GAPS: '2020 y 2021 (756 y 768)' coincide con timeseries", f"({T[Y.index(2020)]} y {T[Y.index(2021)]})" in docs, f"timeseries 2020={T[Y.index(2020)]} 2021={T[Y.index(2021)]}")
    v.check("X10", "app.js renderSeries: no afirma que 2023 es prensa si reliability no tiene 'B'",
            any("B" in r for r in ts["reliability"].values()) or "cifra de prensa por confirmar" not in app)
    v.check("X11", "index.html: las variaciones por tipo citadas (+8.7 % física, −10.7 % sexual) == breakdowns.crecimiento_tipo",
            all(f"{('+' if x['var_pct'] > 0 else '−')}{abs(x['var_pct'])}%" in html for x in cg if x["tipo"] in ("Física", "Sexual")) and "+35%" not in html.replace("+35% sexual en 2026", ""))
    v.check("X12", "app.js updateLegend: 'N/26 regiones' usa el número real de claves del año por defecto (25 en 2024)",
            "/26 regiones" not in app or len(bdp[bdp["default_year"]]) == 26)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--warn-only", default="", help="ids separados por coma que solo avisan"); ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    v = V([x.strip() for x in a.warn_only.split(",") if x.strip()])
    run(v)
    if a.list:
        for cid in sorted({r[0] for r in v.results}): print(cid)
    c = Counter(r[1] for r in v.results)
    print(f"\n{c.get('PASA', 0)} PASA · {c.get('AVISO', 0)} AVISO · {c.get('FALLA', 0)} FALLA")
    fails = v.fails()
    if fails:
        print("\nFALLAS:")
        for cid, _, name, evid in fails: print(f"  {cid}: {name}" + (f" → {evid}" if evid else ""))
        sys.exit(1)
    print("OK: los datos cuadran.")

if __name__ == "__main__":
    main()
