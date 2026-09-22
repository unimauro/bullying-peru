/* Observatorio Nacional del Bullying — Perú · lógica principal */
(function () {
  const C = window.OBS_CONFIG;
  const fmt = (n) => (n == null ? "—" : n.toLocaleString("es-PE"));
  const store = window.OBS_DATA = {}; // datasets cargados (usados por el chatbot)

  // Seguridad: escapa TODO texto proveniente de JSON antes de inyectarlo con innerHTML
  // (las noticias se auto-actualizan desde fuentes externas vía cron → posible XSS).
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
  // Solo acepta imágenes locales de assets o URLs https de imagen; nada más (evita inyección en style url()).
  const safeImg = (u) => {
    if (typeof u !== "string") return null;
    u = u.trim();
    if (/^assets\/news\/[\w.\-]+\.(jpg|jpeg|png|webp)$/i.test(u)) return u;
    if (/^https:\/\/[^\s"'()<>]+\.(jpg|jpeg|png|webp)(\?[^\s"'()<>]*)?$/i.test(u)) return u;
    return null;
  };
  // Solo enlaces http(s) (evita javascript: en href)
  const safeUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u.trim())) ? u.trim() : "#";

  // Banderas para el ranking mundial
  const FLAGS = {
    "Filipinas": "🇵🇭", "Rep. Dominicana": "🇩🇴", "Marruecos": "🇲🇦", "Indonesia": "🇮🇩",
    "Colombia": "🇨🇴", "Argentina": "🇦🇷", "Nueva Zelanda": "🇳🇿", "Panamá": "🇵🇦",
    "Australia": "🇦🇺", "Brasil": "🇧🇷", "Reino Unido": "🇬🇧", "Estados Unidos": "🇺🇸",
    "Canadá": "🇨🇦", "Uruguay": "🇺🇾", "Costa Rica": "🇨🇷", "Chile": "🇨🇱", "Italia": "🇮🇹",
    "México": "🇲🇽", "Perú": "🇵🇪", "Alemania": "🇩🇪", "Francia": "🇫🇷", "Japón": "🇯🇵",
    "Portugal": "🇵🇹", "Países Bajos": "🇳🇱", "Corea del Sur": "🇰🇷", "Grecia": "🇬🇷", "Polonia": "🇵🇱"
  };

  async function loadJSON(url) {
    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn("[obs] no se pudo cargar", url, e.message);
      return null;
    }
  }

  function echartsTheme() {
    const dark = window.OBS_isDark();
    const line = dark ? "rgba(255,255,255,.08)" : "rgba(20,32,46,.07)";
    return {
      textStyle: { color: dark ? "#a3b3c4" : "#5a6a7d",
        fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif" },
      splitLine: { lineStyle: { color: line, type: "dashed" } },
      tooltip: {
        backgroundColor: dark ? "#1c2a38" : "#ffffff",
        borderColor: dark ? "#29394a" : "#dce4ee",
        borderWidth: 1, padding: 10,
        textStyle: { color: dark ? "#eaf1f8" : "#16202e", fontSize: 12 },
        extraCssText: "box-shadow:0 8px 24px rgba(18,32,46,.16);border-radius:10px;"
      },
      grid: { left: 48, right: 20, top: 30, bottom: 40 }
    };
  }
  // Degradado vertical (barras) u horizontal, para embellecer.
  function grad(color, dir) {
    const c2 = "color-mix(in srgb, " + color + " 55%, transparent)";
    const stops = [{ offset: 0, color }, { offset: 1, color: c2 }];
    return dir === "h"
      ? new echarts.graphic.LinearGradient(0, 0, 1, 0, stops)
      : new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
  }
  const TOOLBOX = { feature: { saveAsImage: { title: "Descargar PNG", pixelRatio: 2, backgroundColor: window.OBS_isDark() ? "#16212d" : "#ffffff" } }, right: 8, top: 4 };
  function mkChart(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const ch = echarts.init(el, null, { renderer: "canvas" });
    window.addEventListener("resize", () => ch.resize());
    return ch;
  }

  /* ---------- KPIs ---------- */
  function renderKPIs(ts) {
    const grid = document.getElementById("kpi-grid");
    if (!ts || !ts.years || !ts.years.length) {
      grid.innerHTML = '<div class="callout">Serie SíseVe pendiente de consolidación. Los KPIs se activarán al cargar <code>timeseries.json</code>.</div>';
      return;
    }
    const years = ts.years;
    const S = ts.series;
    // Último punto disponible por serie (puede no ser el último año).
    function lastPoint(key) {
      const arr = S[key] || [];
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return { i, year: years[i], value: arr[i] };
      return null;
    }
    const cards = [
      { label: "Violencia escolar (reportes)", key: "violencia", tag: "violencia", cls: "k-violencia" },
      { label: "Bullying (reportes)", key: "bullying", tag: "bullying", cls: "k-bullying" },
      { label: "Ciberbullying (reportes)", key: "ciberbullying", tag: "ciber", cls: "k-ciber" }
    ];
    let html = "";
    cards.forEach((c) => {
      const p = lastPoint(c.key);
      if (!p) return;
      const partial = ts.partial_year === p.year;
      // Delta solo entre el punto y el anterior disponible, y solo si ninguno es parcial.
      const rel = (ts.reliability && ts.reliability[c.key] && ts.reliability[c.key][p.i]) || null;
      const relTag = rel === "B" ? ` <span class="pill" style="background:#fbeede;color:#8a5a00">prensa · no oficial</span>` : "";
      let dHtml = "";
      const PANDEMIC = [2020, 2021];
      const prevArr = S[c.key] || [];
      let pi = p.i - 1; while (pi >= 0 && prevArr[pi] == null) pi--;
      // No comparar contra 2020/2021 (escuelas cerradas): la variación sería engañosa.
      if (!partial && pi >= 0 && prevArr[pi] !== 0 && !PANDEMIC.includes(years[pi]) && !PANDEMIC.includes(p.year)) {
        const d = ((p.value - prevArr[pi]) / prevArr[pi]) * 100;
        dHtml = `<span class="delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%</span> vs ${years[pi]}`;
      } else if (partial) {
        dHtml = `<span class="pill" style="background:var(--surface-2);color:var(--text-muted)">año parcial</span>`;
      } else if (rel === "A") {
        dHtml = `<span style="color:var(--text-soft)">dato oficial (Boletín SíseVe)</span>`;
      }
      html += `<div class="kpi ${c.cls}"><span class="tag tag-${c.tag}">${c.tag}</span>
        <div class="label">${c.label}</div>
        <div class="value">${fmt(p.value)}</div>
        <div class="meta">${p.year}${partial ? " (parcial ene–ago)" : ""} · ${dHtml}${relTag}</div></div>`;
    });
    // KPI tasa nacional: usa el último año COMPLETO y OFICIAL (evita numerador parcial sobre matrícula anual).
    if (store.population) {
      const relV = (ts.reliability && ts.reliability.violencia) || [];
      const vArr = S.violencia || [];
      let bi = -1;
      for (let i = vArr.length - 1; i >= 0; i--) {
        if (vArr[i] != null && relV[i] === "A" && ts.partial_year !== years[i]) { bi = i; break; }
      }
      if (bi >= 0) {
        const rate = (vArr[bi] / store.population.total_nacional) * 10000;
        html += `<div class="kpi k-rate"><div class="label">Tasa nacional /10 000</div>
          <div class="value">${rate.toFixed(1)}</div>
          <div class="meta">${years[bi]} (oficial, año completo) · reportes por 10 000 estudiantes (matrícula ${store.population.year})</div></div>`;
      }
    }
    grid.innerHTML = html || '<div class="callout">Sin datos para el último año.</div>';
    const pv = lastPoint("violencia");
    if (pv && ts.partial_year === pv.year) {
      const w = document.getElementById("siseve-warning");
      if (w) w.insertAdjacentHTML("beforeend",
        ` <br><b>${pv.year}</b> es un año <b>parcial</b> (enero–agosto); no es comparable con años completos.`);
    }
  }

  /* ---------- Serie histórica ---------- */
  function renderSeries(ts) {
    const ch = mkChart("chart-series");
    if (!ch) return;
    const src = document.getElementById("series-source");
    if (!ts || !ts.years) {
      ch.setOption({ title: { text: "Serie SíseVe pendiente", left: "center", top: "middle",
        textStyle: { color: "#8494a6", fontSize: 14, fontWeight: "normal" } } });
      return;
    }
    const t = echartsTheme();
    const mk = (name, key, color) => ({
      name, type: "line", smooth: true, symbol: "circle", symbolSize: 7,
      connectNulls: false, data: ts.series[key] || [],
      itemStyle: { color, borderColor: "#fff", borderWidth: 1.5 },
      lineStyle: { width: 3, color, shadowBlur: 8, shadowColor: "color-mix(in srgb," + color + " 40%,transparent)" },
      areaStyle: key === "violencia" ? { color: grad(color), opacity: .5 } : undefined,
      emphasis: { focus: "series" }
    });
    const marks = (ts.annotations || []).map((a) => ({ xAxis: String(a.year) }));
    ch.setOption({
      textStyle: t.textStyle,
      tooltip: Object.assign({ trigger: "axis" }, t.tooltip),
      toolbox: TOOLBOX,
      legend: { top: 0 },
      grid: { left: 56, right: 24, top: 36, bottom: 40 },
      xAxis: { type: "category", data: ts.years.map(String), boundaryGap: false, axisLine: { lineStyle: { color: t.splitLine.lineStyle.color } } },
      yAxis: { type: "value", name: "reportes", splitLine: t.splitLine },
      series: [
        mk("Violencia escolar", "violencia", C.colors.violencia),
        mk("Bullying", "bullying", C.colors.bullying),
        mk("Ciberbullying", "ciberbullying", C.colors.ciber)
      ].filter(s => s.data && s.data.length).map((s, i, arr) => {
        if (i === 0 && marks.length) s.markLine = {
          silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#8494a6" },
          label: { formatter: (p) => (ts.annotations.find(a => String(a.year) === p.value) || {}).label || "", color: "#8494a6", fontSize: 10 },
          data: marks
        };
        // Sombrea el tramo de prensa (fuente B) en la serie de violencia para no confundirlo con lo oficial.
        if (s.name === "Violencia escolar") {
          const relArr = (ts.reliability && ts.reliability.violencia) || [];
          const firstB = relArr.indexOf("B");
          let lastB = -1; for (let k = relArr.length - 1; k >= 0; k--) if (relArr[k] === "B") { lastB = k; break; }
          if (firstB >= 0) s.markArea = {
            silent: true, itemStyle: { color: "rgba(212,85,58,.09)" },
            label: { show: true, position: "insideTop", color: "#b3421f", fontSize: 9, formatter: "prensa" },
            data: [[{ xAxis: String(ts.years[firstB]) }, { xAxis: String(ts.years[lastB]) }]]
          };
        }
        return s;
      })
    });
    src.innerHTML = `Fuente 2013–2022: ${esc(ts.source || "MINEDU — SíseVe")} ` +
      (ts.source_url ? `<a href="${safeUrl(ts.source_url)}" target="_blank" rel="noopener">(oficial)</a>` : "") +
      `. 2024–2026: <a href="${safeUrl(ts.source_tablero || "https://siseve.minedu.gob.pe/")}" target="_blank" rel="noopener">tablero oficial SíseVe</a> (2026 parcial). Solo <b>2023</b> (sombreado) es cifra de prensa por confirmar.`;
  }

  /* ---------- Colegios (prensa) ---------- */
  function renderSchools(sc) {
    const tbody = document.querySelector("#schools-table tbody");
    const src = document.getElementById("schools-source");
    if (!tbody) return;
    if (!sc || !sc.data) { tbody.innerHTML = '<tr><td colspan="4" class="loading">Sin datos.</td></tr>'; return; }
    tbody.innerHTML = sc.data.map(d => `
      <tr>
        <td><b>${esc(d.cadena)}</b></td>
        <td class="num">${d.sedes != null ? fmt(d.sedes) : "—"}</td>
        <td class="num">${d.total_2022_2026 != null ? fmt(d.total_2022_2026) : (d.reportes_2026 != null ? fmt(d.reportes_2026) + " <span style='color:var(--text-soft)'>(2026)</span>" : "—")}</td>
        <td class="num">${d.por_sede != null ? "<b style='color:var(--brand)'>" + d.por_sede + "</b>" : "—"}</td>
      </tr>`).join("");
    if (src) src.innerHTML = `Fuente: ${esc(sc.source)}. <a href="${safeUrl(sc.source_url)}" target="_blank" rel="noopener">Ver ↗</a> · <b>Reportes acumulados en ~4.7 años, repartidos entre todas las sedes.</b>`;
  }

  /* ---------- Estacionalidad (mensual) ---------- */
  function renderMonthly(m) {
    const ch = mkChart("chart-monthly");
    const src = document.getElementById("monthly-source");
    if (!ch) return;
    if (!m || !m.series) { ch.setOption({ title: { text: "Sin datos mensuales", left: "center", top: "middle", textStyle: { color: "#9c8b76", fontWeight: "normal", fontSize: 13 } } }); return; }
    const t = echartsTheme();
    const colors = { "2024": "#93b8d6", "2025": "#2f80c4", "2026": "#f97316" };
    const series = Object.keys(m.series).map((y) => ({
      name: y, type: "line", smooth: true, symbol: "circle", symbolSize: 6, connectNulls: false,
      data: m.series[y], itemStyle: { color: colors[y] || C.colors.violencia }, lineStyle: { width: y === "2026" ? 3.5 : 2.5, color: colors[y] || C.colors.violencia },
      areaStyle: y === "2026" ? { color: grad(colors[y]), opacity: .35 } : undefined
    }));
    ch.setOption({
      textStyle: t.textStyle, grid: { left: 52, right: 20, top: 34, bottom: 34 },
      tooltip: Object.assign({ trigger: "axis" }, t.tooltip),
      toolbox: TOOLBOX, legend: { top: 0 },
      xAxis: { type: "category", data: m.months, boundaryGap: false, axisLine: { lineStyle: { color: t.splitLine.lineStyle.color } } },
      yAxis: { type: "value", name: "reportes/mes", splitLine: t.splitLine },
      series
    });
    if (src) src.innerHTML = `Fuente: ${esc(m.source)} · <a href="${safeUrl(m.source_url)}" target="_blank" rel="noopener">tablero SíseVe</a>. 2026 parcial (ene–ago).`;
  }

  /* ---------- Territorio ---------- */
  function deptRows(year) {
    const bd = store.byDepartment && store.byDepartment[year];
    const pop = store.population;
    if (!bd || !pop) return [];
    const popMap = {};
    pop.data.forEach((d) => { popMap[d.department] = d.students; });
    // agrega Lima si SíseVe reporta "Lima" agregado
    return Object.keys(bd).map((dep) => {
      let students = popMap[dep];
      if (students == null && /lima/i.test(dep)) {
        students = (popMap["Lima Metropolitana"] || 0) + (popMap["Región Lima"] || 0);
      }
      const cases = bd[dep].cases || 0;
      const rate = students ? (cases / students) * 10000 : null;
      return { department: dep, cases, students: students || null, rate };
    });
  }

  function renderTerritory(year) {
    const rows = deptRows(year);
    const chA = mkChart("chart-abs"), chR = mkChart("chart-rate");
    const t = echartsTheme();
    const barOpt = (data, color, unit) => ({
      textStyle: t.textStyle, grid: { left: 118, right: 30, top: 8, bottom: 28 },
      tooltip: Object.assign({ trigger: "axis", valueFormatter: (v) => (unit === "rate" ? v.toFixed(1) : fmt(v)) }, t.tooltip),
      toolbox: TOOLBOX,
      xAxis: { type: "value", splitLine: t.splitLine, axisLabel: { fontSize: 10 } },
      yAxis: { type: "category", data: data.map(d => d.name), inverse: true, axisLabel: { fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{ type: "bar", data: data.map(d => d.value), itemStyle: { color: grad(color, "h"), borderRadius: [0, 6, 6, 0] }, barMaxWidth: 18,
        label: { show: true, position: "right", fontSize: 10, color: t.textStyle.color, formatter: (p) => unit === "rate" ? p.value.toFixed(1) : fmt(p.value) } }]
    });
    if (!rows.length) {
      [chA, chR].forEach(ch => ch && ch.setOption({ title: { text: "Pendiente datos SíseVe", left: "center", top: "middle", textStyle: { color: "#8494a6", fontWeight: "normal", fontSize: 13 } } }));
      return;
    }
    const topAbs = [...rows].sort((a, b) => b.cases - a.cases).slice(0, 10).map(d => ({ name: d.department, value: d.cases }));
    const topRate = [...rows].filter(d => d.rate != null).sort((a, b) => b.rate - a.rate).slice(0, 10).map(d => ({ name: d.department, value: +d.rate.toFixed(1) }));
    chA.setOption(barOpt(topAbs, C.colors.violencia, "abs"));
    chR.setOption(barOpt(topRate, C.colors.exposicion, "rate"));
    // Aviso: si el año está incompleto (prensa/parcial, pocas regiones), no es un ranking nacional.
    const info = yearInfo(year);
    const warn = (ch, on) => ch.setOption({ graphic: on ? [{ type: "text", right: 10, top: 6, style: { text: "⚠ muestra incompleta (" + info.n + " regiones) — no es ranking nacional", fill: "#b3421f", font: "600 10px -apple-system, sans-serif" } }] : [] });
    warn(chA, info.incomplete); warn(chR, info.incomplete);
  }

  /* ---------- Mapa ---------- */
  let map, geoLayer, mapMetric = "cases", mapYear;
  async function initMap() {
    const geo = await loadJSON(C.geojson);
    // Sin teselas externas (CARTO/OSM piden API key o tienen límites): coroplético
    // de departamentos sobre fondo limpio. Cero dependencias de mapas base.
    map = L.map("map", { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    map.attributionControl.setPrefix('GeoJSON: juaneladio/peru-geojson (MPL-2.0)');
    if (!geo) { document.getElementById("map").innerHTML = '<div class="loading">No se pudo cargar el GeoJSON.</div>'; return; }
    store.geo = geo;
    drawMap();
    try { map.fitBounds(geoLayer.getBounds(), { padding: [12, 12] }); } catch (e) {}
    // Leyenda
    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () { const div = L.DomUtil.create("div", "legend"); div.id = "map-legend"; return div; };
    legend.addTo(map);
    updateLegend();
  }

  const _norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace("PROV. CONST. DEL ", "").trim();
  // Devuelve {cases, students, rate} para el polígono del GeoJSON, agregando Lima Metropolitana + Región Lima.
  function metricAgg(depName) {
    const rows = deptRows(mapYear);
    const target = _norm(depName);
    let matches;
    if (target === "LIMA") matches = rows.filter(r => /LIMA/.test(_norm(r.department))); // Metro + Región Lima
    else if (target === "CALLAO") matches = rows.filter(r => /CALLAO/.test(_norm(r.department)));
    else matches = rows.filter(r => _norm(r.department) === target);
    if (!matches.length) return null;
    const cases = matches.reduce((a, r) => a + (r.cases || 0), 0);
    const students = matches.reduce((a, r) => a + (r.students || 0), 0);
    const rate = students ? (cases / students) * 10000 : null;
    return { cases, students, rate };
  }
  function metricValue(depName) {
    const a = metricAgg(depName);
    if (!a) return null;
    return mapMetric === "rate" ? a.rate : a.cases;
  }

  // Rampa multicolor (azul → teal → verde → ámbar → naranja) para el coroplético.
  const MAP_RAMP = ["#dbeafe", "#93cdea", "#57bfc0", "#7fcf7a", "#e3cf5a", "#ec9a4e", "#d4553a"];
  // Escala por CUANTILES: reparte los colores por ranking, no por magnitud, para que
  // todos los departamentos con datos se distingan aunque Lima sea un valor atípico.
  function makeScale() {
    const rows = deptRows(mapYear);
    const vals = rows.map(r => (mapMetric === "rate" ? r.rate : r.cases)).filter(v => v != null).sort((a, b) => a - b);
    return function (v) {
      if (v == null) return "#e7ded0"; // sin dato (cálido)
      if (vals.length <= 1) return MAP_RAMP[MAP_RAMP.length - 1];
      let lo = 0; while (lo < vals.length && vals[lo] < v) lo++;
      const frac = lo / (vals.length - 1);
      return MAP_RAMP[Math.min(MAP_RAMP.length - 1, Math.round(frac * (MAP_RAMP.length - 1)))];
    };
  }
  function currentMax() {
    const rows = deptRows(mapYear);
    const vals = rows.map(r => (mapMetric === "rate" ? r.rate : r.cases)).filter(v => v != null);
    return vals.length ? Math.max(...vals) : 1;
  }
  // Nota de fuente y cobertura según el año seleccionado (oficial A vs prensa B, parcial/incompleto).
  function yearInfo(year) {
    const bd = store.byDepartment || {};
    const rel = (bd.reliability_by_year && bd.reliability_by_year[year]) || "B";
    const n = bd[year] && typeof bd[year] === "object" ? Object.keys(bd[year]).length : 0;
    const partial = store.timeseries && store.timeseries.partial_year === +year;
    return { rel, n, partial, incomplete: rel !== "A" || n < 20 };
  }
  function updateMapSource() {
    const el = document.getElementById("map-source"); if (!el) return;
    const info = yearInfo(mapYear);
    let s = info.rel === "A"
      ? `Fuente: MINEDU — Boletín "SíseVe en cifras" ${mapYear} (oficial, 26 regiones).`
      : `Fuente: prensa citando a MINEDU (nivel B)${info.partial ? ", " + mapYear + " parcial (ene–ago)" : ""}.`;
    if (info.incomplete) s += ` Cobertura parcial: ${info.n} de 26 regiones; el resto queda "sin dato".`;
    s += " Matrícula: INEI 2024 · GeoJSON: juaneladio/peru-geojson (MPL-2.0). Colores por cuantiles (ranking), no proporcionales.";
    el.textContent = s;
  }

  function drawMap() {
    if (!store.geo) return;
    if (geoLayer) map.removeLayer(geoLayer);
    const scale = makeScale();
    geoLayer = L.geoJSON(store.geo, {
      style: (f) => {
        const name = f.properties.NOMBDEP || f.properties.name || "";
        return { color: "#fff", weight: 1, fillOpacity: 0.9, fillColor: scale(metricValue(name)) };
      },
      onEachFeature: (f, layer) => {
        const name = f.properties.NOMBDEP || "";
        const agg = metricAgg(name);
        const nm = /^LIMA$/.test(_norm(name)) ? "Lima (Metropolitana + Región)" : name;
        layer.bindTooltip(
          `<b>${esc(nm)}</b><br>` +
          (!agg ? "Sin dato SíseVe" :
            (`Reportes: ${fmt(agg.cases)}` + (agg.rate != null ? `<br>Tasa: ${agg.rate.toFixed(1)} /10 000` : "") +
             (agg.students ? `<br>Matrícula: ${fmt(agg.students)}` : ""))),
          { sticky: true });
        layer.on("mouseover", () => layer.setStyle({ weight: 2.5, color: "#14202e" }));
        layer.on("mouseout", () => geoLayer.resetStyle(layer));
      }
    }).addTo(map);
    updateMapSource();
  }
  function updateLegend() {
    const el = document.getElementById("map-legend"); if (!el) return;
    const rows = deptRows(mapYear);
    const vals = rows.map(r => (mapMetric === "rate" ? r.rate : r.cases)).filter(v => v != null).sort((a, b) => a - b);
    const fmtV = (v) => v == null ? "—" : (mapMetric === "rate" ? v.toFixed(1) : fmt(Math.round(v)));
    const lo = vals[0], mid = vals[Math.floor((vals.length - 1) / 2)], hi = vals[vals.length - 1];
    const title = mapMetric === "rate" ? "Tasa por 10 000 estudiantes" : "N.º de reportes";
    const bar = MAP_RAMP.map(c => `<span style="flex:1;height:12px;background:${c}"></span>`).join("");
    el.innerHTML =
      `<b>${title}</b>` +
      `<div style="display:flex;gap:1px;border-radius:4px;overflow:hidden;margin:6px 0 3px;width:150px">${bar}</div>` +
      `<div style="display:flex;justify-content:space-between;width:150px;color:var(--text-soft);font-size:.68rem">` +
        `<span>${fmtV(lo)}</span><span>${fmtV(mid)}</span><span>${fmtV(hi)}</span></div>` +
      `<div style="margin-top:6px"><i style="background:#e7ded0"></i>sin dato</div>` +
      `<div style="color:var(--text-soft);font-size:.66rem;margin-top:3px">Escala por cuantiles (ranking), ${vals.length}/26 regiones</div>`;
  }

  /* ---------- Prevalencia ---------- */
  function renderPrevalence(ctx) {
    const ch = mkChart("chart-prevalence");
    const src = document.getElementById("prevalence-source");
    if (!ch || !ctx) return;
    const t = echartsTheme();
    const items = ctx.prevalence_surveys || [];
    ch.setOption({
      textStyle: t.textStyle, grid: { left: 46, right: 20, top: 20, bottom: 96 },
      tooltip: Object.assign({ trigger: "axis", valueFormatter: (v) => v + "%" }, t.tooltip),
      toolbox: TOOLBOX,
      xAxis: { type: "category", data: items.map(i => i.indicator.replace(/ en el entorno escolar/gi, "").replace(/violencia (psicológica y\/o física|física y psicológica)/gi, "").trim().slice(0, 30) + "…"), axisLabel: { interval: 0, rotate: 30, fontSize: 9 } },
      yAxis: { type: "value", max: 100, name: "%", splitLine: t.splitLine },
      series: [{ type: "bar", data: items.map(i => i.value_pct), itemStyle: { color: grad(C.colors.exposicion), borderRadius: [6, 6, 0, 0] }, barMaxWidth: 46,
        label: { show: true, position: "top", formatter: "{c}%", fontSize: 11, fontWeight: 700 } }]
    });
    const s = ctx.sources && ctx.sources.inei_enares_2019;
    if (s) src.innerHTML = `Fuente: ${s.name} — ${s.institution}. <a href="${s.url}" target="_blank" rel="noopener">Ver fuente</a>`;
  }

  /* ---------- SSES (roles) ---------- */
  function renderSSES(ctx) {
    const ch = mkChart("chart-sses");
    if (!ch) return;
    const s = ctx && ctx.sses_2023;
    const src = document.getElementById("sses-source");
    if (!s) { ch.setOption({ title: { text: "Sin datos SSES", left: "center", top: "middle", textStyle: { color: "#8494a6", fontWeight: "normal", fontSize: 13 } } }); return; }
    const r = s.roles;
    const tt = echartsTheme();
    ch.setOption({
      textStyle: tt.textStyle,
      tooltip: Object.assign({ trigger: "item", valueFormatter: (v) => v + "%" }, tt.tooltip),
      legend: { bottom: 0, textStyle: { fontSize: 10 } },
      series: [{
        type: "pie", radius: ["45%", "70%"], center: ["50%", "42%"], avoidLabelOverlap: true,
        itemStyle: { borderColor: window.OBS_isDark() ? "#16212d" : "#fff", borderWidth: 2, borderRadius: 4 },
        label: { formatter: "{d}%", fontSize: 11, fontWeight: 700 },
        data: [
          { name: "Víctima y agresor", value: r.victima_y_agresor, itemStyle: { color: C.colors.bullying } },
          { name: "Solo víctima", value: r.solo_victima, itemStyle: { color: C.colors.ciber } },
          { name: "Solo agresor", value: r.solo_agresor, itemStyle: { color: "#d9a441" } },
          { name: "No implicados", value: r.no_implicados, itemStyle: { color: "#9db3c4" } }
        ]
      }]
    });
    const so = ctx.sources && ctx.sources.minedu_sses_2023;
    if (so) src.innerHTML = `Fuente: ${so.name} — ${so.institution}. <a href="${so.url}" target="_blank" rel="noopener">Ver fuente</a> · ~6 de cada 10 estudiantes involucrados en acoso.`;
  }

  /* ---------- Estudios académicos ---------- */
  function renderStudies(studies) {
    const tbody = document.querySelector("#studies-table tbody");
    if (!studies || !studies.data) { tbody.innerHTML = '<tr><td colspan="5" class="loading">Sin estudios.</td></tr>'; return; }
    tbody.innerHTML = studies.data.map(s => `
      <tr>
        <td><b>${esc(s.title)}</b><br><span style="color:var(--text-soft);font-size:.78rem">${esc(s.authors)} · ${esc(s.journal)}</span></td>
        <td class="num">${esc(s.year || "—")}</td>
        <td style="font-size:.8rem">${esc(s.population)}<br><span style="color:var(--text-soft)">${esc(s.region)}</span></td>
        <td style="font-size:.82rem">${esc(s.findings)}</td>
        <td><a href="${safeUrl(s.url)}" target="_blank" rel="noopener">↗</a></td>
      </tr>`).join("");
  }

  /* ---------- Desgloses (tipología, escuela, género) ---------- */
  function renderBreakdowns(bd) {
    if (!bd) return;
    const t = echartsTheme();
    const pie = (id, data, colors) => {
      const ch = mkChart(id); if (!ch) return;
      ch.setOption({
        textStyle: t.textStyle,
        tooltip: Object.assign({ trigger: "item", valueFormatter: (v) => fmt(v) }, t.tooltip),
        legend: { bottom: 0, textStyle: { fontSize: 10 } },
        series: [{ type: "pie", radius: ["40%", "68%"], center: ["50%", "44%"],
          itemStyle: { borderColor: window.OBS_isDark() ? "#16212d" : "#fff", borderWidth: 2, borderRadius: 4 },
          label: { formatter: "{d}%", fontSize: 11, fontWeight: 700 },
          data: data.map((d, i) => ({ name: d.name, value: d.value, itemStyle: { color: colors[i % colors.length] } })) }]
      });
    };
    const hbar = (id, data, color, unit) => {
      const ch = mkChart(id); if (!ch) return;
      ch.setOption({
        textStyle: t.textStyle, grid: { left: 90, right: 44, top: 8, bottom: 24 },
        tooltip: Object.assign({ trigger: "axis", valueFormatter: (v) => unit === "pct" ? v + "%" : fmt(v) }, t.tooltip),
        xAxis: { type: "value", splitLine: t.splitLine, axisLabel: { fontSize: 10 } },
        yAxis: { type: "category", inverse: true, data: data.map(d => d.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 11 } },
        series: [{ type: "bar", data: data.map(d => d.value), barMaxWidth: 20, itemStyle: { color: grad(color, "h"), borderRadius: [0, 6, 6, 0] },
          label: { show: true, position: "right", fontSize: 10, color: t.textStyle.color, formatter: (p) => unit === "pct" ? p.value + "%" : fmt(p.value) } }]
      });
    };
    const CB = ["#f97316", "#8b5cf6", "#2f80c4", "#12a594", "#e0b13a"];
    pie("bd-tipologia", (bd.tipologia["2022"] || bd.tipologia["2026_ene_ago"] || []).map(x => ({ name: x.tipo, value: x.casos })), CB);
    hbar("bd-nivel", (bd.nivel_educativo_2013_2018 || []).map(x => ({ name: x.nivel, value: x.casos })), C.colors.violencia, "abs");
    pie("bd-gestion", (bd.gestion_2022 || bd.gestion_2013_2018 || []).map(x => ({ name: x.gestion, value: x.casos })), ["#2f80c4", "#f97316"]);
    pie("bd-area", (bd.area_2022 || bd.area_2013_2018 || []).map(x => ({ name: x.area, value: x.casos })), ["#12a594", "#e0b13a"]);
    // Crecimiento por tipo 2026 vs 2025
    const cg = bd.crecimiento_tipo_2026;
    const chG = mkChart("bd-crecimiento");
    if (chG && cg && cg.data) {
      const colors = { "Sexual": "#cc3b52", "Física": "#ec9a4e", "Psicológica": "#e3cf5a" };
      chG.setOption({
        textStyle: t.textStyle, grid: { left: 90, right: 50, top: 8, bottom: 24 },
        tooltip: Object.assign({ trigger: "axis", valueFormatter: (v) => "+" + v + "%" }, t.tooltip),
        xAxis: { type: "value", splitLine: t.splitLine, axisLabel: { fontSize: 10, formatter: "+{value}%" } },
        yAxis: { type: "category", inverse: true, data: cg.data.map(x => x.tipo), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 11 } },
        series: [{ type: "bar", barMaxWidth: 22, data: cg.data.map(x => ({ value: x.var_pct, itemStyle: { color: grad(colors[x.tipo] || C.colors.bullying, "h"), borderRadius: [0, 6, 6, 0] } })),
          label: { show: true, position: "right", fontSize: 11, fontWeight: 700, color: t.textStyle.color, formatter: (p) => "+" + p.value + "%" } }]
      });
      const s = document.getElementById("crecimiento-source");
      if (s) s.innerHTML = `Fuente: ${esc(cg.source)}. <a href="${safeUrl(cg.source_url)}" target="_blank" rel="noopener">Ver ↗</a>`;
    }
  }

  const NEWS_PALETTE = ["#f97316", "#2f80c4", "#12a594", "#8b5cf6", "#d4553a", "#0e8a7d"];
  function newsThumb(n, i, cls) {
    const img = safeImg(n.image);
    if (img) return `<div class="${cls}" style="background-image:url('${encodeURI(img)}')"></div>`;
    const initials = esc((n.media || "?").replace(/[^A-Za-zÁÉÍÓÚñ0-9 ]/g, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase());
    const color = NEWS_PALETTE[i % NEWS_PALETTE.length];
    return `<div class="${cls} ph" style="background:linear-gradient(135deg,${color},color-mix(in srgb,${color} 60%,#000))">${initials}</div>`;
  }

  /* ---------- El bullying en el mundo ---------- */
  function renderWorld(world) {
    const ctxEl = document.getElementById("world-context");
    const intlEl = document.getElementById("intl-news");
    const srcEl = document.getElementById("world-source");
    const ch = mkChart("chart-world");
    if (!world) {
      if (ctxEl) ctxEl.innerHTML = '<div class="callout info"><span>🌎</span><span>Datos internacionales en preparación.</span></div>';
      if (ch) ch.setOption({ title: { text: "En preparación", left: "center", top: "middle", textStyle: { color: "#9c8b76", fontWeight: "normal", fontSize: 13 } } });
      return;
    }
    const t = echartsTheme();
    if (ch && world.countries) {
      const data = [...world.countries].sort((a, b) => a.value_pct - b.value_pct);
      const vmin = data[0].value_pct, vmax = data[data.length - 1].value_pct;
      const WRAMP = ["#57bfc0", "#7fcf7a", "#e3cf5a", "#ec9a4e", "#e0663a", "#cc3b52"];
      const colorFor = (d) => {
        if (/per[uú]/i.test(d.country)) return "#f97316"; // Perú resaltado (naranja)
        const frac = vmax > vmin ? (d.value_pct - vmin) / (vmax - vmin) : 0;
        return WRAMP[Math.min(WRAMP.length - 1, Math.round(frac * (WRAMP.length - 1)))];
      };
      ch.setOption({
        textStyle: t.textStyle, grid: { left: 130, right: 44, top: 8, bottom: 28 },
        tooltip: Object.assign({ trigger: "axis", valueFormatter: (v) => v + "%" }, t.tooltip),
        toolbox: TOOLBOX,
        xAxis: { type: "value", splitLine: t.splitLine, axisLabel: { fontSize: 10, formatter: "{value}%" } },
        yAxis: {
          type: "category", data: data.map(d => d.country), axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { fontSize: 11, formatter: (name) => (FLAGS[name] || "🏳️") + "  " + name }
        },
        series: [{
          type: "bar", barMaxWidth: 18,
          data: data.map(d => ({
            value: d.value_pct,
            itemStyle: {
              color: grad(colorFor(d), "h"), borderRadius: [0, 6, 6, 0],
              borderColor: /per[uú]/i.test(d.country) ? "#b45309" : "transparent",
              borderWidth: /per[uú]/i.test(d.country) ? 1.5 : 0
            }
          })),
          label: { show: true, position: "right", fontSize: 10, color: t.textStyle.color, formatter: (p) => p.value + "%" }
        }]
      });
    }
    if (ctxEl && world.global_context) {
      ctxEl.innerHTML = world.global_context.map(g => `<div class="callout info" style="margin:8px 0"><span>🌍</span><span>${esc(g.text)} <a href="${safeUrl(g.url)}" target="_blank" rel="noopener">↗</a></span></div>`).join("");
    }
    if (intlEl && world.news) {
      intlEl.innerHTML = "<h4 style='margin:14px 0 6px;font-size:.9rem'>Noticias internacionales</h4>" +
        world.news.map((n, i) => `<a class="rail-item" style="margin-bottom:8px" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
          ${newsThumb(n, i, "rail-thumb")}
          <div class="rail-body"><div class="t">${esc(n.title)}</div><div class="m">${esc(n.media)} · ${esc(n.date)} · ${esc(n.country || "")}</div></div></a>`).join("");
    }
    if (srcEl) srcEl.innerHTML = world.source ? "Fuente: " + esc(world.source) : "";
  }

  /* ---------- Libros ---------- */
  function renderBooks(books) {
    const el = document.getElementById("books-grid");
    if (!el) return;
    if (!books || !books.data) { el.innerHTML = '<div class="callout info"><span>📚</span><span>Lista de libros en preparación.</span></div>'; return; }
    const card = (b) => `
      <div class="book">
        <div class="cover"></div>
        <h4>${b.url ? `<a href="${safeUrl(b.url)}" target="_blank" rel="noopener">${esc(b.title)}</a>` : esc(b.title)}</h4>
        <div class="by">${esc(b.authors || "")}${b.year ? " · " + esc(b.year) : ""}</div>
        ${b.audience ? `<span class="aud">${esc(b.audience)}</span>` : ""}
        <p>${esc(b.note || "")}</p>
      </div>`;
    let html = books.data.map(card).join("");
    if (books.resources && books.resources.length) {
      html += `<div style="grid-column:1/-1;margin-top:6px;font-weight:800;font-size:.95rem">📥 Recursos oficiales gratuitos</div>`;
      html += books.resources.map(card).join("");
    }
    el.innerHTML = html;
  }

  /* ---------- Marquee vertical animado de casos (rail derecho) ---------- */
  function renderTicker(news) {
    const track = document.getElementById("rail-track");
    if (!track || !news || !news.data) return;
    const card = (n, i) => `<a class="rail-item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
        ${newsThumb(n, i, "rail-thumb")}
        <div class="rail-body"><div class="t">${esc(n.title)}</div><div class="m">${esc(n.media)} · ${esc(n.date)} · ${esc(n.department)}</div></div></a>`;
    const items = news.data.map(card).join("");
    // Duplicado para el bucle vertical continuo.
    track.innerHTML = items + items;
    // Duración proporcional al número de casos (más suave).
    track.style.animationDuration = Math.max(18, news.data.length * 4) + "s";
  }

  /* ---------- Noticias (grid con foto) ---------- */
  function renderNews(news) {
    const el = document.getElementById("news-list");
    if (!news || !news.data) { el.innerHTML = '<div class="loading">Sin noticias.</div>'; return; }
    el.innerHTML = news.data.map((n, i) => {
      const lv = /^[A-Z_]+$/.test(n.verification_level || "") ? n.verification_level : "REPORTADO";
      return `
      <a class="news-item" href="${safeUrl(n.url)}" target="_blank" rel="noopener">
        ${newsThumb(n, i, "news-thumb")}
        <div class="news-body">
          <div class="meta"><span class="badge lv-${lv}">${esc(lv.replace(/_/g, " "))}</span>
            <span>${esc(n.date)}</span> · <span>${esc(n.media)}</span> · <span>${esc(n.department)}</span></div>
          <h4>${esc(n.title)}</h4>
          <p style="margin:0;font-size:.85rem;color:var(--text-muted)">${esc(n.summary)}</p>
        </div>
      </a>`; }).join("");
  }

  /* ---------- Timeline ---------- */
  function renderTimeline(leg) {
    const el = document.getElementById("timeline");
    if (!leg || !leg.data) { el.innerHTML = '<li class="loading">Sin datos.</li>'; return; }
    el.innerHTML = leg.data.map(l => `
      <li><span class="date">${esc(String(l.date).slice(0, 4))}</span>
        <div class="ev-title">${esc(l.law)}</div>
        <div class="ev-desc">${esc(l.description)} <a href="${safeUrl(l.url)}" target="_blank" rel="noopener">↗</a></div>
      </li>`).join("");
  }

  /* ---------- Tabla / explorador ---------- */
  let tableSort = { k: "cases", dir: -1 };
  function renderTable(year) {
    const tbody = document.querySelector("#data-table tbody");
    let rows = deptRows(year);
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="loading">Datos SíseVe por departamento pendientes.</td></tr>'; return; }
    rows.sort((a, b) => {
      const va = a[tableSort.k], vb = b[tableSort.k];
      if (typeof va === "string") return va.localeCompare(vb) * tableSort.dir;
      return ((va ?? -1) - (vb ?? -1)) * tableSort.dir;
    });
    tbody.innerHTML = rows.map(r => `
      <tr><td>${r.department}</td>
        <td class="num">${fmt(r.cases)}</td>
        <td class="num">${fmt(r.students)}</td>
        <td class="num">${r.rate == null ? "—" : r.rate.toFixed(1)}</td></tr>`).join("");
    store._tableRows = rows;
  }
  function exportCSV(year) {
    const rows = store._tableRows || deptRows(year);
    const head = "departamento,reportes,matricula,tasa_10000\n";
    const body = rows.map(r => `"${r.department}",${r.cases},${r.students ?? ""},${r.rate == null ? "" : r.rate.toFixed(2)}`).join("\n");
    const blob = new Blob([head + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `bullying-peru-departamentos-${year}.csv`; a.click();
  }

  /* ---------- Fuentes ---------- */
  function renderSources(sources) {
    const tbody = document.querySelector("#sources-table tbody");
    if (!sources || !sources.data) { tbody.innerHTML = '<tr><td colspan="5" class="loading">Catálogo de fuentes en construcción.</td></tr>'; return; }
    tbody.innerHTML = sources.data.map(s => {
      const rl = /^[ABCD]$/.test(s.reliability_level || "") ? s.reliability_level : "D";
      return `<tr><td>${esc(s.source_name)}</td><td>${esc(s.institution)}</td><td>${esc(s.data_period || "—")}</td>
        <td><span class="badge b-${rl}">${rl}</span></td>
        <td><a href="${safeUrl(s.url)}" target="_blank" rel="noopener">↗</a></td></tr>`; }).join("");
  }

  /* ---------- Selectores de año ---------- */
  function fillYearSelectors(ts) {
    const years = (store.byDepartment && Object.keys(store.byDepartment)) ||
      (ts && ts.years && ts.years.map(String)) || [];
    const sorted = years.map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
    // Año por defecto: el más completo/oficial (default_year), si existe.
    const def = (store.byDepartment && store.byDepartment.default_year) || sorted[0];
    ["map-year", "table-year"].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = sorted.map(y => `<option value="${y}"${y === def ? " selected" : ""}>${y}${y === def ? " ★" : ""}</option>`).join("") || '<option>—</option>';
    });
    return def;
  }

  /* ---------- Init ---------- */
  async function init() {
    const [ts, byDep, pop, ctx, leg, news, sources, studies, breakdowns, world, books, monthly, schools] = await Promise.all([
      loadJSON(C.data.timeseries), loadJSON(C.data.byDepartment), loadJSON(C.data.population),
      loadJSON(C.data.context), loadJSON(C.data.legislation), loadJSON(C.data.news), loadJSON(C.data.sources),
      loadJSON(C.data.studies), loadJSON(C.data.breakdowns), loadJSON(C.data.world), loadJSON(C.data.books),
      loadJSON(C.data.monthly), loadJSON(C.data.schools)
    ]);
    Object.assign(store, { timeseries: ts, byDepartment: byDep, population: pop, context: ctx, legislation: leg, news, sources, studies, breakdowns, world, books, monthly, schools });

    // fecha de actualización
    const dates = [ts, byDep, pop, ctx, news].filter(Boolean).map(d => d.retrieval_date || (d.source && d.source.retrieval_date)).filter(Boolean);
    document.getElementById("last-updated").textContent = dates.sort().pop() || "2026-09-18";

    const defaultYear = fillYearSelectors(ts);
    mapYear = defaultYear;

    // Cada bloque en su propio try/catch: un fallo aislado no debe tumbar el resto.
    const safe = (label, fn) => { try { fn(); } catch (e) { console.error("[obs] fallo en " + label, e); } };
    safe("KPIs", () => renderKPIs(ts));
    safe("serie", () => renderSeries(ts));
    safe("mensual", () => renderMonthly(monthly));
    safe("colegios", () => renderSchools(schools));
    safe("prevalencia", () => renderPrevalence(ctx));
    safe("sses", () => renderSSES(ctx));
    safe("desgloses", () => renderBreakdowns(breakdowns));
    safe("estudios", () => renderStudies(studies));
    safe("noticias", () => renderNews(news));
    safe("ticker", () => renderTicker(news));
    safe("mundo", () => renderWorld(world));
    safe("libros", () => renderBooks(books));
    safe("timeline", () => renderTimeline(leg));
    safe("fuentes", () => renderSources(sources));
    safe("territorio", () => renderTerritory(defaultYear));
    safe("tabla", () => renderTable(defaultYear));
    try { await initMap(); } catch (e) { console.error("[obs] fallo en mapa", e); }

    // eventos
    document.getElementById("map-year").addEventListener("change", (e) => { mapYear = +e.target.value; drawMap(); updateLegend(); });
    document.querySelectorAll("#map-metric button").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll("#map-metric button").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); mapMetric = b.dataset.metric; drawMap(); updateLegend();
    }));
    document.getElementById("table-year").addEventListener("change", (e) => { renderTable(+e.target.value); renderTerritory(+e.target.value); });
    document.getElementById("export-csv").addEventListener("click", () => exportCSV(+document.getElementById("table-year").value));
    document.querySelectorAll("#data-table th").forEach(th => th.addEventListener("click", () => {
      const k = th.dataset.k; tableSort = { k, dir: tableSort.k === k ? -tableSort.dir : (k === "department" ? 1 : -1) };
      renderTable(+document.getElementById("table-year").value);
    }));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
