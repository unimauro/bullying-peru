/* Observatorio Nacional del Bullying — Perú · lógica principal */
(function () {
  const C = window.OBS_CONFIG;
  const fmt = (n) => (n == null ? "—" : n.toLocaleString("es-PE"));
  const store = window.OBS_DATA = {}; // datasets cargados (usados por el chatbot)

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
    const last = years[years.length - 1];
    const prev = years.length > 1 ? years[years.length - 2] : null;
    const get = (key, y) => (ts.series[key] && ts.series[key][years.indexOf(y)]) ?? null;
    const delta = (key) => {
      if (!prev) return null;
      const a = get(key, prev), b = get(key, last);
      if (a == null || b == null || a === 0) return null;
      return ((b - a) / a) * 100;
    };
    const partial = ts.partial_year === last;
    // Para la comparación interanual usamos el último par de años COMPLETOS y comparables.
    // Si el último año es parcial, no comparamos contra un año completo (sería engañoso).
    const cards = [
      { label: "Violencia escolar (reportes)", key: "violencia", tag: "violencia" },
      { label: "Bullying (reportes)", key: "bullying", tag: "bullying" },
      { label: "Ciberbullying (reportes)", key: "ciberbullying", tag: "ciber" }
    ];
    let html = "";
    cards.forEach((c) => {
      const v = get(c.key, last);
      if (v == null) {
        if (c.key === "ciberbullying") {
          html += `<div class="kpi"><span class="tag tag-${c.tag}">${c.tag}</span>
            <div class="label">${c.label}</div><div class="value" style="font-size:1rem;color:var(--text-soft)">Sin serie anual</div>
            <div class="meta">SíseVe no publica el desglose anual de ciberbullying</div></div>`;
        }
        return;
      }
      const d = partial ? null : delta(c.key);
      const dHtml = d == null ?
        (partial ? `<span class="pill">año parcial — sin comparación</span>` : "") :
        `<span class="delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%</span> vs ${prev}`;
      html += `<div class="kpi"><span class="tag tag-${c.tag}">${c.tag}</span>
        <div class="label">${c.label}</div>
        <div class="value">${fmt(v)}</div>
        <div class="meta">${last}${partial ? " (parcial ene–ago)" : ""} · ${dHtml}</div></div>`;
    });
    // KPI tasa nacional: total oficial del año / matrícula nacional (no sumar departamentos parciales)
    if (store.population) {
      const totalCases = get("violencia", last);
      if (totalCases != null) {
        const rate = (totalCases / store.population.total_nacional) * 10000;
        html += `<div class="kpi"><div class="label">Tasa nacional /10 000</div>
          <div class="value">${rate.toFixed(1)}</div>
          <div class="meta">${last}${partial ? " parcial" : ""} · reportes por 10 000 estudiantes (matrícula ${store.population.year})</div></div>`;
      }
    }
    grid.innerHTML = html || '<div class="callout">Sin datos para el último año.</div>';
    if (partial) {
      document.getElementById("siseve-warning").insertAdjacentHTML("beforeend",
        ` <br><b>${last}</b> es un año <b>parcial</b> (enero–agosto); no es comparable con años completos.`);
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
        return s;
      })
    });
    src.innerHTML = `Fuente: ${ts.source || "MINEDU — SíseVe"}. ` +
      (ts.source_url ? `<a href="${ts.source_url}" target="_blank" rel="noopener">Ver fuente</a>` : "");
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

  function metricValue(depName) {
    const rows = deptRows(mapYear);
    // normaliza nombre GeoJSON (MAYÚSCULAS, sin tildes) contra datos
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace("PROV. CONST. DEL ", "").trim();
    const target = norm(depName);
    let match = rows.find(r => norm(r.department) === target);
    if (!match && target === "LIMA") match = rows.find(r => /LIMA/.test(norm(r.department)));
    if (!match && target === "CALLAO") match = rows.find(r => /CALLAO/.test(norm(r.department)));
    if (!match) return null;
    return mapMetric === "rate" ? match.rate : match.cases;
  }

  function colorScale(v, max) {
    if (v == null) return "#d7dee7";
    const ramp = ["#e3eef6", "#bcd8ea", "#8fbcd9", "#5f9cc5", "#3778ab", "#1f5f8b"];
    const i = Math.min(ramp.length - 1, Math.floor((v / (max || 1)) * ramp.length));
    return ramp[i];
  }
  function currentMax() {
    const rows = deptRows(mapYear);
    const vals = rows.map(r => (mapMetric === "rate" ? r.rate : r.cases)).filter(v => v != null);
    return vals.length ? Math.max(...vals) : 1;
  }

  function drawMap() {
    if (!store.geo) return;
    if (geoLayer) map.removeLayer(geoLayer);
    const max = currentMax();
    geoLayer = L.geoJSON(store.geo, {
      style: (f) => {
        const name = f.properties.NOMBDEP || f.properties.name || "";
        return { color: "#fff", weight: 1, fillOpacity: 0.85, fillColor: colorScale(metricValue(name), max) };
      },
      onEachFeature: (f, layer) => {
        const name = f.properties.NOMBDEP || "";
        const v = metricValue(name);
        const rows = deptRows(mapYear);
        const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
        const row = rows.find(r => norm(r.department).includes(norm(name)) || norm(name).includes(norm(r.department)));
        layer.bindTooltip(
          `<b>${name}</b><br>` +
          (v == null ? "Sin dato SíseVe" :
            (mapMetric === "rate" ? `Tasa: ${v.toFixed(1)} /10 000` : `Reportes: ${fmt(v)}`)) +
          (row && row.students ? `<br>Matrícula: ${fmt(row.students)}` : ""),
          { sticky: true });
        layer.on("mouseover", () => layer.setStyle({ weight: 2.5, color: "#14202e" }));
        layer.on("mouseout", () => geoLayer.resetStyle(layer));
      }
    }).addTo(map);
  }
  function updateLegend() {
    const el = document.getElementById("map-legend"); if (!el) return;
    const max = currentMax();
    const ramp = ["#e3eef6", "#8fbcd9", "#3778ab", "#1f5f8b"];
    const labels = mapMetric === "rate"
      ? ["bajo", "", "", "alto"] : ["pocos", "", "", "muchos"];
    el.innerHTML = `<b>${mapMetric === "rate" ? "Tasa /10 000" : "N.º reportes"}</b><br>` +
      ramp.map((c, i) => `<i style="background:${c}"></i>${labels[i]}`).join(" ") +
      `<br><span style="color:#8494a6">máx: ${mapMetric === "rate" ? max.toFixed(1) : fmt(Math.round(max))}</span>`;
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
        <td><b>${s.title}</b><br><span style="color:var(--text-soft);font-size:.78rem">${s.authors} · ${s.journal}</span></td>
        <td class="num">${s.year || "—"}</td>
        <td style="font-size:.8rem">${s.population}<br><span style="color:var(--text-soft)">${s.region}</span></td>
        <td style="font-size:.82rem">${s.findings}</td>
        <td><a href="${s.url}" target="_blank" rel="noopener">↗</a></td>
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
    pie("bd-tipologia", (bd.tipologia["2026_ene_ago"] || []).map(x => ({ name: x.tipo, value: x.casos })), CB);
    hbar("bd-nivel", (bd.nivel_educativo_2013_2018 || []).map(x => ({ name: x.nivel, value: x.casos })), C.colors.violencia, "abs");
    pie("bd-gestion", (bd.gestion_2013_2018 || []).map(x => ({ name: x.gestion, value: x.casos })), ["#2f80c4", "#f97316"]);
    pie("bd-area", (bd.area_2013_2018 || []).map(x => ({ name: x.area, value: x.casos })), ["#12a594", "#e0b13a"]);
  }

  const NEWS_PALETTE = ["#f97316", "#2f80c4", "#12a594", "#8b5cf6", "#d4553a", "#0e8a7d"];
  function newsThumb(n, i, cls) {
    if (n.image) return `<div class="${cls}" style="background-image:url('${n.image}')"></div>`;
    const initials = (n.media || "?").replace(/[^A-Za-zÁÉÍÓÚñ0-9 ]/g, "").split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
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
      ch.setOption({
        textStyle: t.textStyle, grid: { left: 96, right: 40, top: 8, bottom: 28 },
        tooltip: Object.assign({ trigger: "axis", valueFormatter: (v) => v + "%" }, t.tooltip),
        toolbox: TOOLBOX,
        xAxis: { type: "value", splitLine: t.splitLine, axisLabel: { fontSize: 10, formatter: "{value}%" } },
        yAxis: { type: "category", data: data.map(d => d.country), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 11 } },
        series: [{ type: "bar", data: data.map(d => ({ value: d.value_pct, itemStyle: { color: grad(/per/i.test(d.country) ? C.colors.bullying : C.colors.violencia, "h"), borderRadius: [0, 6, 6, 0] } })), barMaxWidth: 16,
          label: { show: true, position: "right", fontSize: 10, color: t.textStyle.color, formatter: (p) => p.value + "%" } }]
      });
    }
    if (ctxEl && world.global_context) {
      ctxEl.innerHTML = world.global_context.map(g => `<div class="callout info" style="margin:8px 0"><span>🌍</span><span>${g.text} <a href="${g.url}" target="_blank" rel="noopener">↗</a></span></div>`).join("");
    }
    if (intlEl && world.news) {
      intlEl.innerHTML = "<h4 style='margin:14px 0 6px;font-size:.9rem'>Noticias internacionales</h4>" +
        world.news.map((n, i) => `<a class="tk-item" style="width:auto" href="${n.url}" target="_blank" rel="noopener">
          ${newsThumb(n, i, "tk-thumb")}
          <div class="tk-body"><div class="t">${n.title}</div><div class="m">${n.media} · ${n.date} · ${n.country || ""}</div></div></a>`).join("");
    }
    if (srcEl) srcEl.innerHTML = world.source ? `Fuente: ${world.source}` : "";
  }

  /* ---------- Libros ---------- */
  function renderBooks(books) {
    const el = document.getElementById("books-grid");
    if (!el) return;
    if (!books || !books.data) { el.innerHTML = '<div class="callout info"><span>📚</span><span>Lista de libros en preparación.</span></div>'; return; }
    el.innerHTML = books.data.map(b => `
      <div class="book">
        <div class="cover"></div>
        <h4>${b.url ? `<a href="${b.url}" target="_blank" rel="noopener">${b.title}</a>` : b.title}</h4>
        <div class="by">${b.authors || ""}${b.year ? " · " + b.year : ""}</div>
        ${b.audience ? `<span class="aud">${b.audience}</span>` : ""}
        <p>${b.note || ""}</p>
      </div>`).join("");
  }

  /* ---------- Ticker horizontal de casos (banda superior) ---------- */
  function renderTicker(news) {
    const el = document.getElementById("ticker");
    if (!el || !news || !news.data) return;
    const card = (n, i) => `<a class="tk-item" href="${n.url}" target="_blank" rel="noopener">
        ${newsThumb(n, i, "tk-thumb")}
        <div class="tk-body"><div class="t">${n.title}</div><div class="m">${n.media} · ${n.date} · ${n.department}</div></div></a>`;
    el.innerHTML = `<div class="tk-track">${news.data.map(card).join("")}</div>`;
  }

  /* ---------- Noticias (grid con foto) ---------- */
  function renderNews(news) {
    const el = document.getElementById("news-list");
    if (!news || !news.data) { el.innerHTML = '<div class="loading">Sin noticias.</div>'; return; }
    el.innerHTML = news.data.map((n, i) => `
      <a class="news-item" href="${n.url}" target="_blank" rel="noopener">
        ${newsThumb(n, i, "news-thumb")}
        <div class="news-body">
          <div class="meta"><span class="badge lv-${n.verification_level}">${n.verification_level.replace(/_/g, " ")}</span>
            <span>${n.date}</span> · <span>${n.media}</span> · <span>${n.department}</span></div>
          <h4>${n.title}</h4>
          <p style="margin:0;font-size:.85rem;color:var(--text-muted)">${n.summary}</p>
        </div>
      </a>`).join("");
  }

  /* ---------- Timeline ---------- */
  function renderTimeline(leg) {
    const el = document.getElementById("timeline");
    if (!leg || !leg.data) { el.innerHTML = '<li class="loading">Sin datos.</li>'; return; }
    el.innerHTML = leg.data.map(l => `
      <li><span class="date">${l.date.slice(0, 4)}</span>
        <div class="ev-title">${l.law}</div>
        <div class="ev-desc">${l.description} <a href="${l.url}" target="_blank" rel="noopener">↗</a></div>
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
    tbody.innerHTML = sources.data.map(s => `
      <tr><td>${s.source_name}</td><td>${s.institution}</td><td>${s.data_period || "—"}</td>
        <td><span class="badge b-${s.reliability_level}">${s.reliability_level}</span></td>
        <td><a href="${s.url}" target="_blank" rel="noopener">↗</a></td></tr>`).join("");
  }

  /* ---------- Selectores de año ---------- */
  function fillYearSelectors(ts) {
    const years = (store.byDepartment && Object.keys(store.byDepartment)) ||
      (ts && ts.years && ts.years.map(String)) || [];
    const sorted = years.map(Number).filter(n => !isNaN(n)).sort((a, b) => b - a);
    ["map-year", "table-year"].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = sorted.map(y => `<option value="${y}">${y}</option>`).join("") || '<option>—</option>';
    });
    return sorted[0];
  }

  /* ---------- Init ---------- */
  async function init() {
    const [ts, byDep, pop, ctx, leg, news, sources, studies, breakdowns, world, books] = await Promise.all([
      loadJSON(C.data.timeseries), loadJSON(C.data.byDepartment), loadJSON(C.data.population),
      loadJSON(C.data.context), loadJSON(C.data.legislation), loadJSON(C.data.news), loadJSON(C.data.sources),
      loadJSON(C.data.studies), loadJSON(C.data.breakdowns), loadJSON(C.data.world), loadJSON(C.data.books)
    ]);
    Object.assign(store, { timeseries: ts, byDepartment: byDep, population: pop, context: ctx, legislation: leg, news, sources, studies, breakdowns, world, books });

    // fecha de actualización
    const dates = [ts, byDep, pop, ctx, news].filter(Boolean).map(d => d.retrieval_date || (d.source && d.source.retrieval_date)).filter(Boolean);
    document.getElementById("last-updated").textContent = dates.sort().pop() || "2026-09-18";

    const defaultYear = fillYearSelectors(ts);
    mapYear = defaultYear;

    // Cada bloque en su propio try/catch: un fallo aislado no debe tumbar el resto.
    const safe = (label, fn) => { try { fn(); } catch (e) { console.error("[obs] fallo en " + label, e); } };
    safe("KPIs", () => renderKPIs(ts));
    safe("serie", () => renderSeries(ts));
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
