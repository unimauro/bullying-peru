/* Nivel distrital del mapa: drill-down departamento → distritos y vista nacional por distrito.
 * Se engancha al mapa Leaflet de app.js sin tocarlo:
 *   window.OBS_districts.init({ map, store, L, esc, fmt })   // al final de initMap()
 *   map.fire('obs:deptclick', { name })                     // desde el click del departamento
 * Carga perezosa (fetch) de data/geo/peru-distrital.geojson y data/processed/by_district.json
 * SOLO al activar la vista distrital o al hacer clic en un departamento.
 * Fuente: microdato SíseVe (MINEDU) por colegio, agregado en scripts/build_by_district.py.
 * Registro administrativo (reportes) ≠ prevalencia. Sin reportes → "sin dato" (no se imputa).
 */
(function () {
  "use strict";
  const GEO_URL = "data/geo/peru-distrital.geojson";
  const DATA_URL = "data/processed/by_district.json";
  const RAMP = ["#dbeafe", "#93cdea", "#57bfc0", "#7fcf7a", "#e3cf5a", "#ec9a4e", "#d4553a"]; // = MAP_RAMP (app.js)
  const NODATA = "#e7ded0";
  const MODE_CLASS = "obs-dist-mode";

  let map, store, L, esc, fmt;
  let geo = null, data = null, loading = null;
  let mode = "dept";           // "dept" (capa departamental de app.js) | "all" (país por distrito) | "one" (un departamento)
  let currentDep = null;       // NOMBDEP mostrado en modo "one"
  let period = "map";          // "map" = año seleccionado en el mapa | "total" = 2013–2026
  let layer = null, ctl = null, legendCtl = null, deptBounds = null;
  let ui = {};

  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().replace(/^PROV(INCIA)? CONST(ITUCIONAL)? DEL /, "");
  const title = (s) => String(s || "").toLowerCase().replace(/(^|[\s(\-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\bDe\b/g, "de").replace(/\bDel\b/g, "del").replace(/\bLa\b/g, "la").replace(/\bLos\b/g, "los").replace(/\bY\b/g, "y")
    .replace(/^./, (c) => c.toUpperCase());

  /* ---------- carga perezosa ---------- */
  function ensureLoaded() {
    if (geo && data) return Promise.resolve();
    if (loading) return loading;
    setStatus("Cargando distritos…");
    loading = Promise.all([
      fetch(GEO_URL).then(r => { if (!r.ok) throw new Error(GEO_URL + " " + r.status); return r.json(); }),
      fetch(DATA_URL).then(r => { if (!r.ok) throw new Error(DATA_URL + " " + r.status); return r.json(); })
    ]).then(([g, d]) => {
      geo = g; data = d;
      store.districtsGeo = g; store.byDistrict = d; // disponible para el chatbot / consola
      setStatus("");
    }).catch(err => {
      loading = null;
      setStatus("No se pudo cargar el nivel distrital.");
      console.error("[obs districts]", err);
      throw err;
    });
    return loading;
  }

  /* ---------- periodo / valores ---------- */
  function mapYear() {
    if (store && store.mapYear != null && store.mapYear !== "") return +store.mapYear;
    const sel = document.getElementById("map-year");
    if (sel && sel.value && !isNaN(+sel.value)) return +sel.value;
    return null;
  }
  function activeYear() { return period === "total" ? null : mapYear(); }
  function yearIdx(y) { return data && data.years ? data.years.indexOf(y) : -1; }
  function entry(f) { return data && data.distritos ? data.distritos[f.properties.IDDIST] : null; }
  function value(e, y) {
    if (!e) return null;
    if (y == null) return e.t;
    const i = yearIdx(y);
    return i < 0 ? null : (e.y[i] || 0);
  }
  function periodLabel() {
    const y = activeYear();
    if (y == null) return "2013–2026";
    const partial = data && data.years && y === data.years[data.years.length - 1];
    return String(y) + (partial ? " (ene–ago, parcial)" : "");
  }

  function featuresFor() {
    if (!geo) return [];
    if (mode === "one" && currentDep) { const t = norm(currentDep); return geo.features.filter(f => norm(f.properties.NOMBDEP) === t); }
    return geo.features;
  }
  // Escala por cuantiles (ranking) sobre los distritos visibles, como en app.js.
  function makeScale(feats, y) {
    const vals = feats.map(f => value(entry(f), y)).filter(v => v != null).sort((a, b) => a - b);
    const fn = function (v) {
      if (v == null) return NODATA;
      if (vals.length <= 1) return RAMP[RAMP.length - 1];
      let lo = 0; while (lo < vals.length && vals[lo] < v) lo++;
      const frac = lo / (vals.length - 1);
      return RAMP[Math.min(RAMP.length - 1, Math.round(frac * (RAMP.length - 1)))];
    };
    fn.vals = vals;
    return fn;
  }

  /* ---------- render ---------- */
  function tooltipHTML(f) {
    const p = f.properties, e = entry(f), y = activeYear();
    const name = e ? e.nombre : title(p.NOMBDIST);
    const prov = e ? e.provincia : title(p.NOMBPROV);
    let h = `<b>${esc(name)}</b><br><span class="obs-dist-tt-sub">${esc(prov)} · ${esc(title(p.NOMBDEP))}</span><br>`;
    if (!e) {
      h += "Sin reportes en el microdato SíseVe";
    } else {
      if (y != null) h += `Reportes ${esc(periodLabel())}: <b>${fmt(value(e, y))}</b><br>`;
      h += `Reportes 2013–2026: <b>${fmt(e.t)}</b><br>`;
      h += `Colegios con reportes: ${fmt(e.n_colegios)}`;
      const iLast = yearIdx(2026);
      if (y !== 2026 && iLast >= 0 && e.y[iLast]) h += `<br>2026 (ene–ago, parcial): ${fmt(e.y[iLast])}`;
    }
    h += `<div class="obs-dist-tt-src">Microdato SíseVe (MINEDU); registro ≠ prevalencia</div>`;
    return h;
  }

  function render() {
    if (!geo || !data || mode === "dept") return;
    if (layer) { map.removeLayer(layer); layer = null; }
    const feats = featuresFor();
    const y = activeYear();
    const scale = makeScale(feats, y);
    layer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
      style: (f) => ({ className: "obs-dist", color: "#fff", weight: mode === "one" ? 1 : 0.5, fillOpacity: 0.9, fillColor: scale(value(entry(f), y)) }),
      onEachFeature: (f, ly) => {
        ly.bindTooltip(tooltipHTML(f), { sticky: true, className: "obs-dist-tooltip" });
        ly.on("mouseover", () => { ly.setStyle({ weight: 2.5, color: "#14202e" }); ly.bringToFront(); });
        ly.on("mouseout", () => layer && layer.resetStyle(ly));
        if (mode === "all") ly.on("click", () => showDepartment(f.properties.NOMBDEP));
      }
    }).addTo(map);
    map.getContainer().classList.add(MODE_CLASS);
    renderLegend(scale, feats.length);
    updateUI();
  }

  function renderLegend(scale, nFeats) {
    if (!legendCtl) {
      legendCtl = L.control({ position: "bottomright" });
      legendCtl.onAdd = () => { const d = L.DomUtil.create("div", "legend obs-dist-legend"); L.DomEvent.disableClickPropagation(d); return d; };
    }
    if (!legendCtl._map) legendCtl.addTo(map);
    const el = legendCtl.getContainer();
    const vals = scale.vals;
    const lo = vals[0], mid = vals[Math.floor((vals.length - 1) / 2)], hi = vals[vals.length - 1];
    const fv = (v) => v == null ? "—" : fmt(v);
    const bar = RAMP.map(c => `<span style="flex:1;height:12px;background:${c}"></span>`).join("");
    const scope = mode === "one" && currentDep ? esc(title(currentDep)) : "Perú";
    el.innerHTML =
      `<b>Reportes SíseVe por distrito</b><br><span class="obs-dist-sub">${scope} · ${esc(periodLabel())}</span>` +
      `<div style="display:flex;gap:1px;border-radius:4px;overflow:hidden;margin:6px 0 3px;width:150px">${bar}</div>` +
      `<div style="display:flex;justify-content:space-between;width:150px;color:var(--text-soft);font-size:.68rem">` +
        `<span>${fv(lo)}</span><span>${fv(mid)}</span><span>${fv(hi)}</span></div>` +
      `<div style="margin-top:6px"><i style="background:${NODATA}"></i>sin dato (sin reportes)</div>` +
      `<div class="obs-dist-sub">Cuantiles (ranking), ${vals.length}/${nFeats} distritos con dato</div>` +
      `<div class="obs-dist-sub">Microdato SíseVe (MINEDU) 2013–2026; registro ≠ prevalencia</div>`;
  }

  function clearDistricts() {
    if (layer) { map.removeLayer(layer); layer = null; }
    if (legendCtl && legendCtl._map) legendCtl.remove();
    map.getContainer().classList.remove(MODE_CLASS);
  }

  /* ---------- modos ---------- */
  function showAll() {
    return ensureLoaded().then(() => {
      mode = "all"; currentDep = null;
      render();
      try { map.fitBounds(layer.getBounds(), { padding: [12, 12] }); } catch (e) {}
    }).catch(() => {});
  }
  function showDepartment(name) {
    if (!name) return Promise.resolve();
    return ensureLoaded().then(() => {
      const t = norm(name);
      if (!geo.features.some(f => norm(f.properties.NOMBDEP) === t)) { setStatus("Sin distritos para " + name); return; }
      mode = "one"; currentDep = name;
      render();
      try { map.fitBounds(layer.getBounds(), { padding: [12, 12] }); } catch (e) {}
    }).catch(() => {});
  }
  function showDepartments() {
    mode = "dept"; currentDep = null;
    clearDistricts();
    updateUI();
    if (deptBounds) { try { map.fitBounds(deptBounds, { padding: [12, 12] }); } catch (e) {} }
  }

  /* ---------- control ---------- */
  function setStatus(msg) { if (ui.status) ui.status.textContent = msg || ""; }
  function updateUI() {
    if (!ui.btnDept) return;
    ui.btnDept.classList.toggle("active", mode === "dept");
    ui.btnDist.classList.toggle("active", mode !== "dept");
    ui.back.hidden = mode !== "one";
    ui.period.hidden = mode === "dept";
    if (mode === "one" && currentDep) {
      const n = featuresFor().length;
      ui.back.textContent = "← Volver a departamentos";
      setStatus(`${title(currentDep)}: ${n} distritos`);
    } else if (mode === "all") {
      setStatus(`${geo ? geo.features.length : ""} distritos`);
    } else setStatus("");
  }
  function buildControl() {
    ctl = L.control({ position: "topleft" });
    ctl.onAdd = function () {
      const div = L.DomUtil.create("div", "obs-dist-ctl leaflet-bar");
      div.innerHTML =
        `<div class="obs-dist-seg" role="group" aria-label="Nivel del mapa">` +
          `<button type="button" class="obs-dist-btn active" data-mode="dept">Departamentos</button>` +
          `<button type="button" class="obs-dist-btn" data-mode="all">Distritos</button></div>` +
        `<select class="obs-dist-period" aria-label="Periodo" hidden>` +
          `<option value="map">Año del mapa</option><option value="total">Total 2013–2026</option></select>` +
        `<button type="button" class="obs-dist-back" hidden>← Volver a departamentos</button>` +
        `<span class="obs-dist-status" aria-live="polite"></span>`;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      ui.btnDept = div.querySelector('[data-mode="dept"]');
      ui.btnDist = div.querySelector('[data-mode="all"]');
      ui.period = div.querySelector(".obs-dist-period");
      ui.back = div.querySelector(".obs-dist-back");
      ui.status = div.querySelector(".obs-dist-status");
      ui.btnDept.addEventListener("click", showDepartments);
      ui.btnDist.addEventListener("click", showAll);
      ui.back.addEventListener("click", showDepartments);
      ui.period.addEventListener("change", () => { period = ui.period.value; render(); });
      return div;
    };
    ctl.addTo(map);
  }

  function init(opts) {
    opts = opts || {};
    map = opts.map; store = opts.store || window.OBS_DATA || {}; L = opts.L || window.L;
    esc = opts.esc || ((s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    fmt = opts.fmt || ((n) => (n == null ? "—" : n.toLocaleString("es-PE")));
    if (!map || !L) { console.warn("[obs districts] falta map o L"); return; }
    try { deptBounds = store.geo ? L.geoJSON(store.geo).getBounds() : map.getBounds(); } catch (e) { deptBounds = null; }
    buildControl();
    // Drill-down: app.js dispara map.fire('obs:deptclick', { name }) en el click del departamento.
    map.on("obs:deptclick", (e) => showDepartment(e && e.name));
    // Seguir el año del mapa (app.js redibuja su capa departamental, que queda oculta por CSS en modo distrital).
    const sel = document.getElementById("map-year");
    if (sel) sel.addEventListener("change", () => { if (mode !== "dept") render(); });
  }

  window.OBS_districts = { init, showDepartment, showAll, showDepartments, get mode() { return mode; }, get department() { return currentDep; } };
})();
