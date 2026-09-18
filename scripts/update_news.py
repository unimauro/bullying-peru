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
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


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


def og_image(url):
    try:
        html = fetch(url, timeout=20).decode("utf-8", "ignore")
    except Exception:
        return None
    m = (re.search(r'property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html)
         or re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']og:image', html))
    return m.group(1) if m else None


def download_img(url, ref, dest_base):
    img = og_image(url)
    if not img:
        return None
    img = urllib.parse.urljoin(url, img)
    try:
        data = fetch(img, timeout=20)
    except Exception:
        return None
    ext = re.search(r"\.(jpg|jpeg|png|webp)", img.split("?")[0].lower())
    ext = "." + (ext.group(1).replace("jpeg", "jpg") if ext else "jpg")
    os.makedirs(IMGDIR, exist_ok=True)
    fn = dest_base + ext
    with open(os.path.join(IMGDIR, fn), "wb") as f:
        f.write(data)
    return "assets/news/" + fn


def main():
    doc = json.load(open(NEWS, encoding="utf-8"))
    items = doc.get("data", [])
    seen = {norm(x.get("title")) for x in items} | {x.get("url") for x in items}

    added = 0
    for q in QUERIES:
        for it in google_news(q):
            key = norm(it["title"])
            if key in seen or it["url"] in seen:
                continue
            seen.add(key); seen.add(it["url"])
            h = hashlib.md5(it["url"].encode()).hexdigest()[:8]
            it["image"] = download_img(it["url"], it["url"], "auto_" + h)
            items.append(it)
            added += 1

    # ordena por fecha desc, mantiene curados primero en empates
    items.sort(key=lambda x: (x.get("date", ""), 0 if x.get("auto") else 1), reverse=True)
    doc["data"] = items[:MAX_ITEMS]
    doc["retrieval_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    doc["last_auto_update"] = datetime.now(timezone.utc).isoformat()
    json.dump(doc, open(NEWS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[ok] noticias: +{added} nuevas, total {len(doc['data'])}")


if __name__ == "__main__":
    main()
