#!/usr/bin/env python3
"""
update_news.py — Actualiza data/news/news.json con noticias recientes de bullying/
acoso escolar en el Perú, usando Google News RSS (sin dependencias externas).

- Mantiene los casos curados existentes y AÑADE los nuevos (dedupe por título/URL).
- Marca los automáticos con verification_level = "REPORTADO" (nivel C).
- Ordena por fecha desc y limita a MAX_ITEMS.
- Intenta bajar la imagen og:image de cada noticia a assets/news/ (best-effort).

Pensado para correr a diario vía GitHub Actions (.github/workflows/update-news.yml).
No inventa nada: si una fuente no responde, se omite.
"""
import json, os, re, ssl, sys, urllib.request, urllib.parse, hashlib
from datetime import datetime, timezone
from xml.etree import ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS = os.path.join(ROOT, "data", "news", "news.json")
IMGDIR = os.path.join(ROOT, "assets", "news")
MAX_ITEMS = 14
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
QUERIES = [
    "bullying colegio Perú", "acoso escolar Perú", "ciberbullying Perú",
    "violencia escolar SíseVe", "bullying escolar Perú",
]
# Solo se aceptan titulares de estos medios (evita fuentes poco confiables o irrelevantes).
TRUSTED_MEDIA = [
    "rpp", "el comercio", "la republica", "infobae", "andina", "gestion",
    "peru21", "tv peru", "america tv", "america noticias", "latina", "atv",
    "ojo publico", "convoca", "exitosa", "canal n", "el peruano", "epa",
    "wayka", "idl", "la encerrona", "diario correo", "correo", "expreso",
    "ipe", "unicef", "unesco", "defensoria",
]
CTX = ssl.create_default_context()          # verificación TLS normal (revisión seguridad 25-09-2026)
MAX_IMG = 2_000_000
MAGIC = {b"\xff\xd8\xff": ".jpg", b"\x89PNG": ".png", b"RIFF": ".webp"}
TRUSTED_DOMAINS = {
    "rpp.pe", "elcomercio.pe", "larepublica.pe", "infobae.com", "andina.pe", "gestion.pe",
    "peru21.pe", "tvperu.gob.pe", "americatv.com.pe", "latina.pe", "atv.pe", "ojo-publico.com",
    "convoca.pe", "exitosanoticias.pe", "canaln.pe", "elperuano.pe", "wayka.pe", "idl.org.pe",
    "laencerrona.pe", "diariocorreo.pe", "expreso.com.pe", "ipe.org.pe", "unicef.org", "unesco.org",
    "defensoria.gob.pe",
}


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.read()


def google_news(query):
    q = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={q}&hl=es-419&gl=PE&ceid=PE:es-419"
    out = []
    try:
        root = ET.fromstring(fetch(url))
    except Exception as e:
        print(f"[warn] RSS falló '{query}': {e}")
        return out
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub = (item.findtext("pubDate") or "").strip()
        source_el = item.find("{http://news.google.com/}source") or item.find("source")
        media = (source_el.text.strip() if source_el is not None and source_el.text else "Google News")
        # limpia " - Medio" del título
        title = re.sub(r"\s+-\s+[^-]+$", "", title)
        date = ""
        for fmt in ("%a, %d %b %Y %H:%M:%S %Z", "%a, %d %b %Y %H:%M:%S %z"):
            try:
                date = datetime.strptime(pub, fmt).strftime("%Y-%m-%d"); break
            except Exception:
                pass
        if not title or not link:
            continue
        out.append({"date": date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "media": media, "title": title, "department": "Nacional",
                    "topic": "violencia_escolar", "summary": "",
                    "verification_level": "REPORTADO", "url": link, "image": None,
                    "auto": True})
    return out


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _strip(s):
    import unicodedata
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def is_trusted(media, url=""):
    """Nombre EXACTO (ya no por subcadena: 'Wikipedia' contenía 'ipe') o dominio final del enlace."""
    m = re.sub(r"[^a-z0-9]", "", _strip(media))
    names = {re.sub(r"[^a-z0-9]", "", t) for t in TRUSTED_MEDIA}
    if m in names or m in {n + "noticias" for n in names} or m in {n + "peru" for n in names}:
        return True
    host = urllib.parse.urlparse(resolve(url)).netloc.lower()
    host = host[4:] if host.startswith("www.") else host
    return bool(host) and any(host == d or host.endswith("." + d) for d in TRUSTED_DOMAINS)


_RESOLVED = {}
def resolve(url):
    """Sigue el redirect de Google News hasta el artículo (necesario para comprobar el dominio y para og:image)."""
    if not url: return ""
    if url in _RESOLVED: return _RESOLVED[url]
    final = url
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
            final = r.geturl()
    except Exception:
        pass
    _RESOLVED[url] = final
    return final


def og_image(url):
    try:
        html = fetch(url, timeout=20).decode("utf-8", "ignore")
    except Exception:
        return None
    m = (re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html)
         or re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']og:image', html))
    return m.group(1) if m else None


def download_img(url, ref, dest_base):
    url = resolve(url)
    img = og_image(url)
    if not img:
        return None
    img = urllib.parse.urljoin(url, img)
    if urllib.parse.urlparse(img).scheme != "https":
        return None
    try:
        req = urllib.request.Request(img, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=20, context=CTX) as r:
            if int(r.headers.get("Content-Length") or 0) > MAX_IMG:
                return None
            data = r.read(MAX_IMG + 1)
    except Exception:
        return None
    if len(data) > MAX_IMG:
        return None
    ext = next((e for mg, e in MAGIC.items() if data.startswith(mg)), None)   # tipo por firma, no por extensión
    if not ext:
        return None
    os.makedirs(IMGDIR, exist_ok=True)
    fn = dest_base + ext
    with open(os.path.join(IMGDIR, fn), "wb") as f:
        f.write(data)
    return "assets/news/" + fn


def main():
    doc = json.load(open(NEWS, encoding="utf-8"))
    items = doc.get("data", [])
    # Limpia items automáticos previos de medios no confiables (los curados a mano se conservan).
    before = len(items)
    items = [x for x in items if (not x.get("auto")) or is_trusted(x.get("media"), x.get("url", ""))]
    if before != len(items):
        print(f"[limpieza] removidos {before - len(items)} items auto de medios no confiables")
    seen = {norm(x.get("title")) for x in items} | {x.get("url") for x in items}

    # 1) recolecta candidatos nuevos (sin descargar imágenes todavía)
    candidates = []
    skipped = 0
    for q in QUERIES:
        for it in google_news(q):
            key = norm(it["title"])
            if key in seen or it["url"] in seen:
                continue
            if not is_trusted(it["media"], it.get("url", "")):
                skipped += 1
                continue
            seen.add(key); seen.add(it["url"])
            candidates.append(it)
    print(f"[filtro] candidatos confiables: {len(candidates)}, descartados por medio: {skipped}")

    # 2) une con existentes, ordena por fecha desc y recorta a MAX_ITEMS
    all_items = items + candidates
    all_items.sort(key=lambda x: (x.get("date", ""), 0 if x.get("auto") else 1), reverse=True)
    kept = all_items[:MAX_ITEMS]

    # 3) descarga imágenes SOLO de los nuevos que se conservan (best-effort)
    added = 0
    for it in kept:
        if it.get("auto") and not it.get("image"):
            h = hashlib.md5(it["url"].encode()).hexdigest()[:8]
            it["image"] = download_img(it["url"], it["url"], "auto_" + h)
            added += 1

    doc["data"] = kept
    doc["retrieval_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc["last_auto_update"] = datetime.now(timezone.utc).isoformat()
    json.dump(doc, open(NEWS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[ok] noticias: +{added} nuevas, total {len(doc['data'])}")


if __name__ == "__main__":
    main()
