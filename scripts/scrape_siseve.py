#!/usr/bin/env python3
"""
scrape_siseve.py — Cosecha reproducible de datos oficiales de SíseVe (MINEDU).

SíseVe NO expone una API JSON/CSV pública. La app (ASP.NET MVC) renderiza HTML del
lado del servidor y protege sus páginas con Google reCAPTCHA Enterprise; los JS internos
devuelven 403 a clientes sin navegador. Por eso la vía fiable es un NAVEGADOR HEADLESS
(Playwright) que recorra el endpoint de detalle por año y por departamento.

Endpoint verificado (HTTP 200):
    https://siseve.minedu.gob.pe/Web/App/MapaDetalle?filter=<BASE64URL(JSON)>

Esquema del filtro (verificado):
    {"isnational": false, "departamento": "Arequipa", "reportDate": "2025", "ubigeoCode": "PE.AR"}
    {"isnational": true,  "reportDate": "2024"}   # nacional

Uso:
    # 1) genera las URLs a cosechar (no requiere red):
    python scripts/scrape_siseve.py --print-urls --years 2013-2026
    # 2) cosecha real (requiere: pip install playwright && playwright install chromium):
    python scripts/scrape_siseve.py --harvest --years 2019-2026 --out data/raw/siseve

IMPORTANTE (metodología): SíseVe registra REPORTES de presuntos hechos, no la prevalencia
real. No sobrescribas datos oficiales con estimaciones. Marca la fecha de cosecha.
"""
import argparse
import base64
import json
import os
from datetime import date

# 26 ámbitos con su ubigeoCode PE.XX (según el mapa de SíseVe).
UBIGEOS = {
    "Amazonas": "PE.AM", "Áncash": "PE.AN", "Apurímac": "PE.AP", "Arequipa": "PE.AR",
    "Ayacucho": "PE.AY", "Cajamarca": "PE.CJ", "Callao": "PE.CL", "Cusco": "PE.CU",
    "Huancavelica": "PE.HV", "Huánuco": "PE.HC", "Ica": "PE.IC", "Junín": "PE.JU",
    "La Libertad": "PE.LL", "Lambayeque": "PE.LB", "Lima": "PE.LI", "Loreto": "PE.LO",
    "Madre de Dios": "PE.MD", "Moquegua": "PE.MO", "Pasco": "PE.PA", "Piura": "PE.PI",
    "Puno": "PE.PU", "San Martín": "PE.SM", "Tacna": "PE.TA", "Tumbes": "PE.TU",
    "Ucayali": "PE.UC",
}
BASE = "https://siseve.minedu.gob.pe/Web/App/MapaDetalle?filter="


def b64(obj: dict) -> str:
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def national_url(year: int) -> str:
    return BASE + b64({"isnational": True, "reportDate": str(year)})


def dept_url(dep: str, year: int) -> str:
    return BASE + b64({"isnational": False, "departamento": dep,
                       "reportDate": str(year), "ubigeoCode": UBIGEOS[dep]})


def parse_years(spec: str):
    if "-" in spec:
        a, b = spec.split("-"); return list(range(int(a), int(b) + 1))
    return [int(y) for y in spec.split(",")]


def print_urls(years):
    for y in years:
        print(f"# {y} nacional\n{national_url(y)}")
        for dep in UBIGEOS:
            print(dept_url(dep, y))


def harvest(years, out_dir):
    """Cosecha real con Playwright. Guarda el HTML crudo por (año, ámbito) en data/raw."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("Instala Playwright: pip install playwright && playwright install chromium")
    os.makedirs(out_dir, exist_ok=True)
    meta = {"retrieval_date": date.today().isoformat(), "source": "MINEDU-SíseVe", "files": []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        for y in years:
            targets = [("nacional", national_url(y))] + [(dep, dept_url(dep, y)) for dep in UBIGEOS]
            for name, url in targets:
                try:
                    page.goto(url, wait_until="networkidle", timeout=45000)
                    html = page.content()
                    fn = os.path.join(out_dir, f"{y}_{name}.html")
                    with open(fn, "w", encoding="utf-8") as f:
                        f.write(html)
                    meta["files"].append({"year": y, "scope": name, "url": url, "file": fn})
                    print(f"[ok] {y} {name}")
                except Exception as e:
                    print(f"[fail] {y} {name}: {e}")
        browser.close()
    with open(os.path.join(out_dir, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"\nCosecha guardada en {out_dir}. Luego parsea el HTML con clean_data.py.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--years", default="2013-2026", help="rango 2013-2026 o lista 2022,2023")
    ap.add_argument("--print-urls", action="store_true")
    ap.add_argument("--harvest", action="store_true")
    ap.add_argument("--out", default="data/raw/siseve")
    args = ap.parse_args()
    yrs = parse_years(args.years)
    if args.harvest:
        harvest(yrs, args.out)
    else:
        print_urls(yrs)
