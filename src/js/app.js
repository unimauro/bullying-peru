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
      const w0 = document.getElementById("siseve-warning");
      const w = w0 && (w0.querySelector("span:last-child") || w0);
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

  /* ---------- Colegios: top nacional + buscador + filtros (microdato oficial) ---------- */
  // schools_top.json (300 colegios, pequeño) se carga al inicio; el índice completo
  // (22 569 colegios, ~4.5 MB) SOLO cuando el usuario busca o filtra. Los detalles por
  // tipo de los colegios fuera del top se cargan por shard de región al abrir la fila.
  const YEARS = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
  const TIPO_LABELS = { fisica: "Física", psicologica: "Psicológica", sexual: "Sexual", bullying: "Bullying (etiqueta)", ciberacoso: "Ciberacoso (etiqueta)", entre_escolares: "Entre escolares", personal_ie: "De personal de la IE" };
  const _fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const _slug = (s) => _fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let schoolsIdx = null, schoolsIdxPromise = null, schoolsTop = null;
  const shardCache = {};
  const sf = { q: "", region: "", gestion: "", nivel: "", year: "" };

  function sparkline(y, sortIdx) {
    const max = Math.max(1, ...y);
    const w = 8, gap = 0, h = 26;
    return `<svg class="spark" viewBox="0 0 ${y.length * w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
      y.map((v, i) => {
        const bh = Math.max(v > 0 ? 2 : 0, Math.round((v / max) * (h - 2)));
        const cls = YEARS[i] === 2026 ? "partial" : (i === sortIdx ? "hi" : "");
        return `<rect x="${i * w + gap}" y="${h - bh}" width="${w - 1.5}" height="${bh}" class="${cls}"><title>${YEARS[i]}: ${v}</title></rect>`;
      }).join("") + `</svg>`;
  }

  async function ensureSchoolsIndex() {
    if (schoolsIdx) return schoolsIdx;
    if (!schoolsIdxPromise) {
      const st = document.getElementById("school-status");
      if (st) st.textContent = "Cargando el índice nacional (22 569 colegios, una sola vez)…";
      schoolsIdxPromise = loadJSON(C.data.schoolsIndex).then(d => { schoolsIdx = Array.isArray(d) ? d : []; return schoolsIdx; });
    }
    return schoolsIdxPromise;
  }

  function schoolsFiltered() {
    const useIndex = !!(sf.q || sf.region || sf.gestion || sf.nivel || sf.year);
    const base = useIndex ? (schoolsIdx || []) : ((schoolsTop && schoolsTop.rows) || []);
    const nq = _fold(sf.q).trim();
    const digits = nq && /^\d+$/.test(nq.replace(/\s/g, ""));
    const yi = sf.year ? YEARS.indexOf(+sf.year) : -1;
    let hits = [];
    for (const r of base) {
      if (sf.region && r.r !== sf.region) continue;
      if (sf.gestion && r.g !== sf.gestion) continue;
      if (sf.nivel && r.nv !== sf.nivel) continue;
      if (nq) {
        const hay = digits ? r.cm : (_fold(r.n) + " " + _fold(r.d) + " " + _fold(r.p) + " " + _fold(r.r) + " " + r.cm);
        if (hay.indexOf(nq) === -1) continue;
      }
      if (yi >= 0 && !(r.y && r.y[yi] > 0)) continue;
      hits.push(r);
    }
    const val = (r) => (yi >= 0 && r.y) ? r.y[yi] : r.t;
    hits.sort((a, b) => val(b) - val(a) || a.n.localeCompare(b.n));
    return { hits, useIndex, yi, val };
  }

  function renderSchoolRows() {
    const tbody = document.getElementById("school-results");
    const st = document.getElementById("school-status");
    const thTotal = document.getElementById("sf-total-th");
    if (!tbody) return;
    const { hits, useIndex, yi, val } = schoolsFiltered();
    const LIMIT = 100;
    const shown = hits.slice(0, LIMIT);
    const yLabel = sf.year ? `Reportes ${sf.year}${sf.year === "2026" ? "*" : ""}` : "Total 2013–2026";
    if (thTotal) thTotal.textContent = yLabel;
    if (!shown.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="loading">Sin coincidencias. Prueba con otro nombre, el código modular o el distrito; o quita algún filtro.</td></tr>';
      if (st) st.textContent = "";
      return;
    }
    const i24 = YEARS.indexOf(2024), i25 = YEARS.indexOf(2025), i26 = YEARS.indexOf(2026);
    tbody.innerHTML = shown.map((r, i) => {
      const y = r.y || [];
      return `<tr class="sc-row" data-slug="${esc(r.s)}" data-region="${esc(r.r)}" tabindex="0" role="button" aria-expanded="false">
        <td>${i + 1}</td>
        <td><span class="sc-name">${esc(r.n)}</span><span class="sc-sub">${esc(r.d)} · ${esc(r.p)} · ${esc(r.r)} · C.M. ${esc(r.cm)}</span></td>
        <td><span class="sc-tag ${r.g === "Público" ? "pub" : "priv"}">${esc(r.g || "")}</span></td>
        <td style="font-size:.78rem">${esc(r.nv || "")}</td>
        <td>${y.length ? sparkline(y, yi) : ""}</td>
        <td class="num ${yi === i24 ? "sort-col" : ""}">${fmt(y[i24] || 0)}</td>
        <td class="num ${yi === i25 ? "sort-col" : ""}">${fmt(y[i25] || 0)}</td>
        <td class="num ${yi === i26 ? "sort-col" : ""}">${fmt(y[i26] || 0)}</td>
        <td class="num"><b class="${yi < 0 ? "sort-col" : ""}">${fmt(val(r))}</b></td>
      </tr>`;
    }).join("");
    if (st) {
      const nT = schoolsTop && schoolsTop.n_total ? fmt(schoolsTop.n_total) : "22 569";
      st.textContent = useIndex
        ? `${fmt(hits.length)} colegio(s) coinciden${hits.length > LIMIT ? `; se muestran los ${LIMIT} con más reportes — afina la búsqueda para ver otros` : ""}.`
        : `Top ${shown.length} nacional por reportes acumulados 2013–2026, de ${nT} colegios con al menos un reporte. Escribe o filtra para buscar cualquier colegio.`;
    }
  }

  async function schoolDetail(slug, region) {
    const top = schoolsTop && schoolsTop.rows && schoolsTop.rows.find(r => r.s === slug);
    if (top && top.tipos) return { y: top.y, tipos: top.tipos, ugel: top.ugel };
    const key = _slug(region);
    if (!shardCache[key]) shardCache[key] = loadJSON("data/processed/schools_detail/" + key + ".json").then(d => d || {});
    const shard = await shardCache[key];
    return shard[slug] || null;
  }

  function renderSchoolDetail(tr, r, det) {
    const id = "scd-" + r.s.replace(/[^a-z0-9]/g, "");
    const y = det.y || r.y || [];
    const tp = det.tipos || {};
    const keys = ["fisica", "psicologica", "sexual", "bullying", "ciberacoso"];
    const rows = YEARS.map((yr, i) => ({ yr, t: y[i] || 0, v: keys.map(k => (tp[k] && tp[k][i]) || 0) })).filter(o => o.t > 0);
    const html = `<tr class="sc-detail"><td colspan="9">
      <p class="sc-meta"><b>${esc(r.n)}</b> · ${esc(r.d)}, ${esc(r.p)} (${esc(r.r)})${det.ugel ? " · " + esc(det.ugel) : ""} · ${esc(r.g || "")} · ${esc(r.nv || "")} · Código modular ${esc(r.cm)}</p>
      <div class="sc-detail-grid">
        <div class="chart" id="${id}"></div>
        <div class="table-scroll" style="max-height:220px"><table class="data"><thead><tr><th>Año</th><th class="num">Total</th>${keys.map(k => `<th class="num">${esc(TIPO_LABELS[k].replace(" (etiqueta)", ""))}</th>`).join("")}</tr></thead>
        <tbody>${rows.slice().reverse().map(o => `<tr><td>${o.yr}${o.yr === 2026 ? "*" : ""}</td><td class="num"><b>${fmt(o.t)}</b></td>${o.v.map(v => `<td class="num">${v ? fmt(v) : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      </div>
      <p class="source" style="margin-top:8px">Física + psicológica + sexual = total del año; bullying y ciberacoso son etiquetas transversales (no se suman). *2026 parcial ene–ago. Registro administrativo, no prevalencia.</p>
    </td></tr>`;
    tr.insertAdjacentHTML("afterend", html);
    const ch = mkChart(id);
    if (!ch) return;
    const t = echartsTheme();
    const stack = ["fisica", "psicologica", "sexual"].map((k, j) => ({
      name: TIPO_LABELS[k], type: "bar", stack: "t", data: YEARS.map((_, i) => (tp[k] && tp[k][i]) || 0),
      itemStyle: { color: ["#d4553a", C.colors.violencia, C.colors.ciber][j] }, barMaxWidth: 22
    }));
    const hasTipos = stack.some(s => s.data.some(v => v > 0));
    ch.setOption({
      textStyle: t.textStyle, tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, t.tooltip),
      legend: { top: 0, textStyle: { fontSize: 10 } }, grid: { left: 36, right: 10, top: 28, bottom: 24 },
      xAxis: { type: "category", data: YEARS.map(String), axisLabel: { fontSize: 9 } },
      yAxis: { type: "value", splitLine: t.splitLine, axisLabel: { fontSize: 9 } },
      series: hasTipos ? stack : [{ name: "Reportes", type: "bar", data: y, itemStyle: { color: C.colors.violencia }, barMaxWidth: 22 }]
    });
  }

  function initSchools() {
    const input = document.getElementById("school-search");
    const tbody = document.getElementById("school-results");
    if (!input || !tbody) return;
    const src = document.getElementById("school-search-source");
    if (src) src.innerHTML = "Fuente: MINEDU — SíseVe, microdato oficial 2013–2026 (acceso a la información pública; consolidado de <a href=\"https://github.com/fiorellatl/observatorio-violencia-escolar\" target=\"_blank\" rel=\"noopener\">fiorellatl/observatorio-violencia-escolar</a>). Reportes acumulados por institución educativa; no es prevalencia ni ranking de calidad. Haz clic en una fila para ver el detalle por año y tipo.";

    // Selectores: regiones (territory.json) y años
    const selR = document.getElementById("sf-region"), selN = document.getElementById("sf-nivel"), selY = document.getElementById("sf-year"), selG = document.getElementById("sf-gestion");
    const regions = (store.territory && store.territory.regiones || []).map(r => r.nombre).sort((a, b) => a.localeCompare(b));
    if (selR) selR.innerHTML = '<option value="">Todas</option>' + regions.map(r => `<option>${esc(r)}</option>`).join("");
    if (selY) selY.innerHTML = '<option value="">Total 2013–2026</option>' + YEARS.slice().reverse().map(y => `<option value="${y}">${y}${y === 2026 ? " (parcial)" : ""}</option>`).join("");
    const fillNivel = (rows) => {
      if (!selN) return;
      const cur = selN.value;
      const lv = Array.from(new Set(rows.map(r => r.nv).filter(Boolean))).sort();
      selN.innerHTML = '<option value="">Todos</option>' + lv.map(n => `<option${n === cur ? " selected" : ""}>${esc(n)}</option>`).join("");
    };
    fillNivel((schoolsTop && schoolsTop.rows) || []);

    const clearBtn = document.getElementById("sf-clear");
    const syncClear = () => { if (clearBtn) clearBtn.hidden = !(sf.q || sf.region || sf.gestion || sf.nivel || sf.year); };
    let tmr = null;
    const apply = async () => {
      syncClear();
      if (sf.q || sf.region || sf.gestion || sf.nivel || sf.year) {
        const had = !!schoolsIdx;
        await ensureSchoolsIndex();
        if (!had) fillNivel(schoolsIdx);
      }
      renderSchoolRows();
    };
    input.addEventListener("input", () => { sf.q = input.value; if (tmr) clearTimeout(tmr); tmr = setTimeout(apply, 160); });
    input.addEventListener("focus", () => { ensureSchoolsIndex().then(() => fillNivel(schoolsIdx)); }, { once: true });
    [[selR, "region"], [selG, "gestion"], [selN, "nivel"], [selY, "year"]].forEach(([el, k]) => { if (el) el.addEventListener("change", () => { sf[k] = el.value; apply(); }); });
    const csvBtn = document.getElementById("sf-csv");
    if (csvBtn) csvBtn.addEventListener("click", async () => { if (sf.q || sf.region || sf.gestion || sf.nivel || sf.year) await ensureSchoolsIndex(); exportSchoolsCSV(); });
    if (clearBtn) clearBtn.addEventListener("click", () => {
      sf.q = sf.region = sf.gestion = sf.nivel = sf.year = ""; input.value = "";
      [selR, selG, selN, selY].forEach(el => { if (el) el.value = ""; });
      apply();
    });

    // Vista: colegios (IE) vs redes (tabla de prensa Región Lima)
    document.querySelectorAll("#school-view button").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll("#school-view button").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      const ie = b.dataset.view === "ie";
      document.getElementById("school-view-ie").hidden = !ie;
      document.getElementById("school-view-redes").hidden = ie;
      document.querySelector(".school-toolbar .school-search-wrap").style.display = ie ? "" : "none";
      document.querySelector(".school-toolbar .school-filters").style.display = ie ? "" : "none";
    }));

    // Detalle al hacer clic en una fila
    const toggleRow = async (tr) => {
      const open = tr.classList.contains("open");
      const next = tr.nextElementSibling;
      if (next && next.classList.contains("sc-detail")) next.remove();
      tr.classList.toggle("open", !open); tr.setAttribute("aria-expanded", String(!open));
      if (open) return;
      const slug = tr.dataset.slug, region = tr.dataset.region;
      const { hits } = schoolsFiltered();
      const r = hits.find(x => x.s === slug) || ((schoolsTop && schoolsTop.rows) || []).find(x => x.s === slug);
      if (!r) return;
      tr.insertAdjacentHTML("afterend", '<tr class="sc-detail"><td colspan="9" class="loading">Cargando detalle…</td></tr>');
      let det = null;
      try { det = await schoolDetail(slug, region); } catch (e) { console.error("[obs] detalle colegio", e); }
      const ph = tr.nextElementSibling; if (ph && ph.classList.contains("sc-detail")) ph.remove();
      if (!tr.classList.contains("open")) return;
      renderSchoolDetail(tr, r, det || { y: r.y });
    };
    tbody.addEventListener("click", (e) => { const tr = e.target.closest("tr.sc-row"); if (tr) toggleRow(tr); });
    tbody.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { const tr = e.target.closest("tr.sc-row"); if (tr) { e.preventDefault(); toggleRow(tr); } } });

    renderSchoolRows();
  }

  /* ---------- Descargas: catálogo JSON + CSV al vuelo ---------- */
  function toCSV(rows, cols) {
    const q = (v) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return "\uFEFF" + cols.map(c => q(c.label)).join(",") + "\n" + rows.map(r => cols.map(c => q(typeof c.get === "function" ? c.get(r) : r[c.get])).join(",")).join("\n");
  }
  function downloadText(name, text, mime) {
    const blob = new Blob([text], { type: mime || "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const yearCols = (get) => YEARS.map((y, i) => ({ label: String(y) + (y === 2026 ? " (parcial)" : ""), get: (r) => get(r, i) }));
  const DATASETS = [
    { id: "timeseries", title: "Serie nacional 2013–2026 por tipo", desc: "Total, física/psicológica/sexual, entre escolares/personal IE, bullying y ciberacoso por año. Microdato oficial.", json: C.data.timeseries,
      csv: () => { const ts = store.timeseries; if (!ts) return null; const rows = ts.years.map((y, i) => ({ y, i }));
        return toCSV(rows, [{ label: "anio", get: r => r.y }, { label: "total", get: r => ts.series.violencia[r.i] }, { label: "fisica", get: r => ts.tipos.fisica[r.i] }, { label: "psicologica", get: r => ts.tipos.psicologica[r.i] }, { label: "sexual", get: r => ts.tipos.sexual[r.i] }, { label: "entre_escolares", get: r => ts.vinculo.entre_escolares[r.i] }, { label: "personal_ie", get: r => ts.vinculo.personal_ie[r.i] }, { label: "bullying_etiqueta", get: r => ts.series.bullying[r.i] }, { label: "ciberacoso_etiqueta", get: r => ts.series.ciberbullying[r.i] }, { label: "parcial", get: r => r.y === ts.partial_year ? "si" : "no" }]); } },
    { id: "monthly", title: "Reportes mensuales 2024–2026", desc: "Serie mes a mes del tablero oficial SíseVe.", json: C.data.monthly,
      csv: () => { const m = store.monthly; if (!m || !m.series) return null; const keys = Object.keys(m.series); const rows = (m.months || []).map((mo, i) => ({ mo, i }));
        return toCSV(rows, [{ label: "mes", get: r => r.mo }].concat(keys.map(k => ({ label: k, get: r => m.series[k][r.i] })))); } },
    { id: "territory", title: "Regiones 2024 (tasa y serie 2013–2026)", desc: "25 regiones: reportes, alumnos, tasa por 1,000, cobertura y serie anual.", json: C.data.territory,
      csv: () => { const t = store.territory; if (!t) return null;
        return toCSV(t.regiones, [{ label: "region", get: "nombre" }, { label: "reportes_2024", get: "reportes" }, { label: "alumnos_2024", get: "alumnos" }, { label: "tasa_x1000", get: "tasa_x1000" }, { label: "cobertura_denominador", get: "cobertura" }, { label: "tasa_aproximada", get: r => r.aproximada ? "si" : "no" }].concat(yearCols((r, i) => (r.serie || {})[YEARS[i]] || 0))); } },
    { id: "by_department", title: "Departamentos por año (mapa)", desc: "Reportes por departamento 2022 (boletín), 2024 (microdato) y 2026 (prensa, parcial).", json: C.data.byDepartment,
      csv: () => { const bd = store.byDepartment; if (!bd) return null; const yrs = Object.keys(bd).filter(k => /^\d{4}$/.test(k)).sort(); const rows = [];
        yrs.forEach(y => Object.keys(bd[y]).forEach(dep => rows.push({ y, dep, cases: bd[y][dep].cases, rel: (bd.reliability_by_year || {})[y] || "" })));
        return toCSV(rows, [{ label: "anio", get: "y" }, { label: "departamento", get: "dep" }, { label: "reportes", get: "cases" }, { label: "nivel_fuente", get: "rel" }]); } },
    { id: "by_district", title: "Distritos (mapa distrital)", desc: "Reportes por distrito, total y por año 2013–2026, n.º de colegios con reportes; clave ubigeo.", json: "data/processed/by_district.json", lazy: true,
      csv: async () => { const d = store.byDistrict || await loadJSON("data/processed/by_district.json"); if (!d) return null; const rows = Object.keys(d.distritos).map(k => Object.assign({ key: k }, d.distritos[k]));
        return toCSV(rows, [{ label: "ubigeo", get: r => r.ubigeo || "" }, { label: "departamento", get: "departamento" }, { label: "provincia", get: "provincia" }, { label: "distrito", get: "nombre" }, { label: "reportes_2013_2026", get: "t" }, { label: "colegios_con_reportes", get: "n_colegios" }].concat(yearCols((r, i) => (r.y || [])[i] || 0))); } },
    { id: "schools_top", title: "Top 300 colegios (con tipos por año)", desc: "Los 300 colegios con más reportes acumulados; serie anual y desglose por tipo.", json: C.data.schoolsTop,
      csv: () => { const s = schoolsTop; if (!s) return null; const cols = [{ label: "codigo_modular", get: "cm" }, { label: "colegio", get: "n" }, { label: "distrito", get: "d" }, { label: "provincia", get: "p" }, { label: "region", get: "r" }, { label: "ugel", get: "ugel" }, { label: "gestion", get: "g" }, { label: "nivel", get: "nv" }, { label: "total_2013_2026", get: "t" }].concat(yearCols((r, i) => r.y[i]));
        ["fisica", "psicologica", "sexual", "bullying", "ciberacoso"].forEach(k => YEARS.forEach((y, i) => cols.push({ label: k + "_" + y, get: r => ((r.tipos || {})[k] || [])[i] || 0 })));
        return toCSV(s.rows, cols); } },
    { id: "schools_index", title: "Todos los colegios (22,569 IIEE)", desc: "Índice nacional completo con reportes acumulados y por año. CSV de ~3 MB.", json: C.data.schoolsIndex, lazy: true,
      csv: async () => { const idx = await ensureSchoolsIndex(); if (!idx) return null;
        return toCSV(idx, [{ label: "codigo_modular", get: "cm" }, { label: "colegio", get: "n" }, { label: "distrito", get: "d" }, { label: "provincia", get: "p" }, { label: "region", get: "r" }, { label: "gestion", get: "g" }, { label: "nivel", get: "nv" }, { label: "total_2013_2026", get: "t" }].concat(yearCols((r, i) => (r.y || [])[i] || 0))); } },
    { id: "correlation", title: "Correlación física↔psicológica", desc: "Por año: r de Pearson, colegios con reportes, colegios con ambos tipos y la distribución (x, y, n colegios).", json: C.data.correlation,
      csv: () => { const c = store.correlation; if (!c) return null; const rows = []; c.anios.forEach(y => (c.datos[y].puntos || []).forEach(p => rows.push({ y, x: p[0], py: p[1], n: p[2], r: c.datos[y].r, col: c.datos[y].colegios, ambos: c.datos[y].ambos })));
        return toCSV(rows, [{ label: "anio", get: "y" }, { label: "reportes_fisicos", get: "x" }, { label: "reportes_psicologicos", get: "py" }, { label: "n_colegios", get: "n" }, { label: "r_pearson_anio", get: "r" }, { label: "colegios_con_reportes_anio", get: "col" }, { label: "colegios_ambos_tipos_anio", get: "ambos" }]); } },
    { id: "breakdowns", title: "Desgloses (gestión, área, sexo, nivel)", desc: "Perfil de casos 2013–2018 y 2022, crecimiento por tipo 2026.", json: C.data.breakdowns },
    { id: "population", title: "Matrícula por departamento (INEI 2024)", desc: "Denominador de las tasas.", json: C.data.population,
      csv: () => { const p = store.population; if (!p) return null; return toCSV(p.data, [{ label: "departamento", get: "department" }, { label: "matricula", get: "students" }]); } },
    { id: "context", title: "Prevalencia (ENARES, SSES) y contexto", desc: "Encuestas de exposición medida, para contrastar con el registro administrativo.", json: C.data.context },
    { id: "sources", title: "Catálogo de fuentes", desc: "Todas las fuentes con URL, periodo y nivel de confiabilidad (A/B/C/D).", json: C.data.sources,
      csv: () => { const s = store.sources; if (!s) return null; return toCSV(s.data, [{ label: "id", get: "source_id" }, { label: "fuente", get: "source_name" }, { label: "institucion", get: "institution" }, { label: "tipo", get: "source_type" }, { label: "url", get: "url" }, { label: "periodo", get: "data_period" }, { label: "ambito", get: "geographic_scope" }, { label: "nivel", get: "reliability_level" }, { label: "notas", get: "notes" }]); } },
    { id: "geo_dist", title: "GeoJSON distrital del Perú", desc: "1,826 polígonos con ubigeo (juaneladio/peru-geojson, MPL-2.0), adelgazado.", json: "data/geo/peru-distrital.geojson" },
    { id: "geo_dep", title: "GeoJSON departamental del Perú", desc: "25 departamentos (juaneladio/peru-geojson, MPL-2.0).", json: C.geojson },
  ];
  function renderDownloads() {
    const grid = document.getElementById("dl-grid"); if (!grid) return;
    grid.innerHTML = DATASETS.map(d => `<div class="dl-card"><div class="dl-title">${esc(d.title)}</div><div class="dl-desc">${esc(d.desc)}</div>
      <div class="dl-actions"><a href="${esc(d.json)}" download target="_blank" rel="noopener">JSON</a>${d.csv ? `<button type="button" data-csv="${esc(d.id)}">CSV</button>` : ""}</div></div>`).join("");
    grid.querySelectorAll("button[data-csv]").forEach(b => b.addEventListener("click", async () => {
      const d = DATASETS.find(x => x.id === b.dataset.csv); if (!d) return;
      const label = b.textContent; b.textContent = "Generando…"; b.disabled = true;
      try { const txt = await d.csv(); if (txt) downloadText("bullying-peru-" + d.id + ".csv", txt); else alert("Este dataset aún no está cargado."); }
      catch (e) { console.error("[obs] csv", e); }
      b.textContent = label; b.disabled = false;
    }));
  }
  function exportSchoolsCSV() {
    const { hits, yi } = schoolsFiltered();
    if (!hits.length) return;
    const cols = [{ label: "codigo_modular", get: "cm" }, { label: "colegio", get: "n" }, { label: "distrito", get: "d" }, { label: "provincia", get: "p" }, { label: "region", get: "r" }, { label: "gestion", get: "g" }, { label: "nivel", get: "nv" }, { label: "total_2013_2026", get: "t" }].concat(yearCols((r, i) => (r.y || [])[i] || 0));
    const tag = [sf.q && "q-" + _slug(sf.q), sf.region && _slug(sf.region), sf.gestion && _slug(sf.gestion), sf.nivel && _slug(sf.nivel), sf.year && "anio-" + sf.year].filter(Boolean).join("_") || (yi >= 0 ? "anio-" + sf.year : "top");
    downloadText("colegios-siseve-" + tag + ".csv", toCSV(hits, cols));
  }

  /* ---------- Composición por tipo (microdato oficial) ---------- */
  let tiposMode = "tipo";
  function renderTipos(ts) {
    const ch = mkChart("chart-tipos");
    if (!ch || !ts || !ts.years) return;
    const t = echartsTheme();
    const yrs = ts.years.map(String);
    const stackDef = tiposMode === "vinculo"
      ? [
          { name: "Entre escolares", key: "entre_escolares", src: ts.vinculo, color: C.colors.violencia },
          { name: "De personal de la IE", key: "personal_ie", src: ts.vinculo, color: C.colors.bullying },
        ]
      : [
          { name: "Física", key: "fisica", src: ts.tipos, color: "#d4553a" },
          { name: "Psicológica", key: "psicologica", src: ts.tipos, color: C.colors.violencia },
          { name: "Sexual", key: "sexual", src: ts.tipos, color: C.colors.ciber },
        ];
    const bars = stackDef.filter(s => s.src && s.src[s.key]).map(s => ({
      name: s.name, type: "bar", stack: "total", data: s.src[s.key],
      itemStyle: { color: s.color }, barMaxWidth: 30, emphasis: { focus: "series" }
    }));
    // Etiquetas transversales (subconjuntos) solo en modo "tipo": líneas superpuestas.
    const lines = tiposMode === "tipo" ? [
      { name: "Bullying (etiqueta)", type: "line", smooth: true, symbol: "circle", symbolSize: 6,
        data: ts.series.bullying || [], itemStyle: { color: C.colors.bullying },
        lineStyle: { width: 2.5, type: "dashed", color: C.colors.bullying } },
      { name: "Ciberacoso (etiqueta)", type: "line", smooth: true, symbol: "circle", symbolSize: 6,
        data: ts.series.ciberbullying || [], itemStyle: { color: C.colors.exposicion },
        lineStyle: { width: 2.5, type: "dashed", color: C.colors.exposicion } },
    ] : [];
    ch.setOption({
      textStyle: t.textStyle,
      tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, t.tooltip),
      toolbox: TOOLBOX, legend: { top: 0 },
      grid: { left: 56, right: 24, top: 36, bottom: 40 },
      xAxis: { type: "category", data: yrs, axisLine: { lineStyle: { color: t.splitLine.lineStyle.color } } },
      yAxis: { type: "value", name: "reportes", splitLine: t.splitLine },
      series: bars.concat(lines)
    }, true);
    const src = document.getElementById("tipos-source");
    if (src) src.innerHTML = `Microdato oficial SíseVe 2013–2026 (${esc(ts.source_microdato || "")}). ` +
      (tiposMode === "tipo"
        ? "Las barras (física + psicológica + sexual) suman el total del año; bullying y ciberacoso son etiquetas transversales (no se suman)."
        : "‘Entre escolares’ + ‘de personal de la IE’ suman el total del año (vínculo agresor↔víctima).");
  }

  /* ---------- Correlación física vs psicológica (anonimizado) ---------- */
  let correlZoom = "near";
  function renderCorrelation(cor) {
    const ch = mkChart("chart-correl");
    if (!ch || !cor || !cor.anios) return;
    const sel = document.getElementById("correl-year");
    const last = cor.anios[cor.anios.length - 1];
    if (sel && !sel.dataset.filled) {
      sel.innerHTML = cor.anios.map(y => `<option value="${y}"${y === last ? " selected" : ""}>${y}${y === cor.anio_parcial ? " (parcial)" : ""}</option>`).join("");
      sel.dataset.filled = "1";
    }
    const strength = (r) => Math.abs(r) >= .7 ? "fuerte" : Math.abs(r) >= .4 ? "moderada" : Math.abs(r) >= .2 ? "débil" : "muy débil";
    const draw = (year) => {
      const t = echartsTheme();
      const d = (cor.datos && cor.datos[year]) || {};
      const pts = (d.puntos || []).map(p => [p[0], p[1], p[2]]);
      const maxN = pts.reduce((m, p) => Math.max(m, p[2]), 1);
      const maxX = pts.reduce((m, p) => Math.max(m, p[0]), 1), maxY = pts.reduce((m, p) => Math.max(m, p[1]), 1);
      const lim = correlZoom === "near" ? 20 : Math.max(maxX, maxY);
      const shownPts = correlZoom === "near" ? pts.filter(p => p[0] <= lim && p[1] <= lim) : pts;
      const hidden = pts.length - shownPts.length;
      const r = d.r, n = d.colegios || 0, ambos = d.ambos || 0;
      const soloF = shownPts.filter(p => p[1] === 0).reduce((a, p) => a + p[2], 0);
      ch.setOption({
        textStyle: t.textStyle,
        tooltip: Object.assign({ trigger: "item", formatter: (o) => `<b>${fmt(o.value[2])} colegio(s)</b><br>Reportes físicos: ${o.value[0]}<br>Reportes psicológicos: ${o.value[1]}` }, t.tooltip),
        toolbox: TOOLBOX,
        visualMap: { type: "continuous", dimension: 2, min: 1, max: maxN, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemWidth: 10, itemHeight: 120, text: ["muchos colegios", "pocos"], textStyle: { fontSize: 10, color: t.textStyle.color }, inRange: { color: ["#93cdea", "#1f5f8b", "#14202e"] } },
        grid: { left: 56, right: 24, top: 44, bottom: 72 },
        xAxis: { type: "value", name: "Reportes físicos por colegio", nameLocation: "middle", nameGap: 28, min: 0, max: lim, splitLine: t.splitLine },
        yAxis: { type: "value", name: "Reportes psicológicos por colegio", nameLocation: "middle", nameGap: 40, min: 0, max: lim, splitLine: t.splitLine },
        series: [{
          type: "scatter", data: shownPts,
          symbolSize: (v) => 5 + 30 * Math.sqrt(v[2] / maxN),
          itemStyle: { opacity: .85, borderColor: "#fff", borderWidth: .6 },
          markLine: { silent: true, symbol: "none", lineStyle: { type: "dashed", color: "#b3421f", width: 1.2 },
            label: { formatter: "misma cantidad de ambos", position: "insideMiddleTop", fontSize: 10, color: "#b3421f" },
            data: [[{ coord: [0, 0] }, { coord: [lim, lim] }]] }
        }]
      }, true);
      const stats = document.getElementById("correl-stats");
      if (stats) stats.innerHTML =
        `<div class="stat"><div class="v">${r == null ? "—" : (+r).toFixed(2)}</div><div class="l">correlación r · ${r == null ? "" : strength(r)}</div></div>` +
        `<div class="stat"><div class="v">${fmt(n)}</div><div class="l">colegios con reportes en ${year}</div></div>` +
        `<div class="stat"><div class="v">${n ? Math.round(ambos / n * 100) : 0}%</div><div class="l">tienen reportes de <b>ambos</b> tipos</div></div>` +
        `<div class="stat"><div class="v">${n ? Math.round((n - ambos) / n * 100) : 0}%</div><div class="l">solo un tipo (físico <i>o</i> psicológico)</div></div>`;
      const rd = document.getElementById("correl-reading");
      if (rd) rd.innerHTML = r == null ? "" :
        `<b>Lectura:</b> en ${year}${year === cor.anio_parcial ? " (parcial)" : ""} la correlación es <b>${strength(r)}</b> (r = ${(+r).toFixed(2)}): saber que un colegio tiene reportes físicos <b>casi no permite predecir</b> cuántos psicológicos tendrá. La mayoría de colegios (${n ? Math.round((n - ambos) / n * 100) : 0}%) aparece con <b>un solo tipo</b>; las burbujas grandes se concentran cerca del origen (1–3 reportes). Las pocas que se alejan por el eje X son colegios con muchos reportes físicos y casi ninguno psicológico, y viceversa.` +
        (hidden ? ` <span style="color:var(--text-muted)">(${hidden} combinación(es) con más de ${lim} reportes están fuera de esta vista; pulsa "Todo el rango").</span>` : "");
      const src = document.getElementById("correl-source");
      if (src) src.innerHTML = `${esc(cor.note || "")} Fuente: ${esc(cor.source || "")}${soloF ? "" : ""}`;
    };
    const cur = () => (sel ? sel.value : last);
    draw(cur());
    if (sel && !sel.dataset.wired) {
      sel.addEventListener("change", () => draw(cur())); sel.dataset.wired = "1";
      document.querySelectorAll("#correl-zoom button").forEach(b => b.addEventListener("click", () => {
        document.querySelectorAll("#correl-zoom button").forEach(x => x.classList.remove("active"));
        b.classList.add("active"); correlZoom = b.dataset.zoom; draw(cur());
      }));
    }
  }

  /* ---------- Colegios (SíseVe Región Lima) ---------- */
  let schoolsSort = "total";
  function renderSchools(sc) {
    const tbody = document.querySelector("#schools-table tbody");
    const src = document.getElementById("schools-source");
    if (!tbody) return;
    if (!sc || !sc.data) { tbody.innerHTML = '<tr><td colspan="11" class="loading">Sin datos.</td></tr>'; return; }
    const rows = sc.data.map(d => {
      const s = d.sedes || 1;
      const y2026 = (d.y && d.y[4]) || 0;
      return Object.assign({}, d, { por_sede: Math.round((y2026 / s) * 100) / 100 });
    });
    rows.sort((a, b) => (b[schoolsSort] || 0) - (a[schoolsSort] || 0));
    tbody.innerHTML = rows.map((d, i) => {
      const chain = d.sedes > 3;
      return `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(d.colegio)}</b></td>
        <td style="font-size:.78rem;color:var(--text-muted)">${esc(d.tipo || "")}</td>
        <td class="num">${fmt(d.sedes)}</td>
        ${(d.y || []).map(v => `<td class="num" style="color:var(--text-soft)">${fmt(v)}</td>`).join("")}
        <td class="num"><b>${fmt(d.total)}</b></td>
        <td class="num"><b style="color:${d.por_sede >= 10 ? "#cc3b52" : "var(--brand)"}">${d.por_sede.toFixed(2)}</b></td>
      </tr>`;
    }).join("");
    if (src) src.innerHTML = `Fuente: ${esc(sc.source)}. Difundido por prensa (ATV, El Comercio ECData, La República) vía transparencia a la DRELM. ${esc(sc.period || "")}.`;
    // Toggle de orden
    document.querySelectorAll("#schools-sort button").forEach(b => {
      b.onclick = () => {
        document.querySelectorAll("#schools-sort button").forEach(x => x.classList.remove("active"));
        b.classList.add("active"); schoolsSort = b.dataset.sort; renderSchools(sc);
      };
    });
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
    if (window.OBS_districts) { try { window.OBS_districts.init({ map, store, L, esc, fmt }); } catch (e) { console.error("[obs] distritos", e); } }
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
      ? (mapYear === 2024
          ? `Fuente: MINEDU — SíseVe, microdato oficial ${mapYear} (25 regiones, acceso a la información pública).`
          : `Fuente: MINEDU — Boletín "SíseVe en cifras" ${mapYear} (oficial).`)
      : `Fuente: prensa citando a MINEDU (nivel B)${info.partial ? ", " + mapYear + " parcial (ene–ago)" : ""}.`;
    if (info.incomplete) s += ` Cobertura parcial: ${info.n} de 26 regiones; el resto queda "sin dato".`;
    s += " Matrícula: INEI 2024 · GeoJSON: juaneladio/peru-geojson (MPL-2.0). Colores por cuantiles (ranking), no proporcionales.";
    el.textContent = s;
  }

  function drawMap() {
    if (!store.geo) return;
    store.mapYear = mapYear; store.mapMetric = mapMetric;
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
        layer.on("click", () => map.fire("obs:deptclick", { name }));
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
    const [ts, byDep, pop, ctx, leg, news, sources, studies, breakdowns, world, books, monthly, schools, territory, correlation, schoolsTopData] = await Promise.all([
      loadJSON(C.data.timeseries), loadJSON(C.data.byDepartment), loadJSON(C.data.population),
      loadJSON(C.data.context), loadJSON(C.data.legislation), loadJSON(C.data.news), loadJSON(C.data.sources),
      loadJSON(C.data.studies), loadJSON(C.data.breakdowns), loadJSON(C.data.world), loadJSON(C.data.books),
      loadJSON(C.data.monthly), loadJSON(C.data.schools), loadJSON(C.data.territory), loadJSON(C.data.correlation), loadJSON(C.data.schoolsTop)
    ]);
    Object.assign(store, { timeseries: ts, byDepartment: byDep, population: pop, context: ctx, legislation: leg, news, sources, studies, breakdowns, world, books, monthly, schools, territory, correlation });
    schoolsTop = schoolsTopData;

    // fecha de actualización
    const dates = [ts, byDep, pop, ctx, news].filter(Boolean).map(d => d.retrieval_date || (d.source && d.source.retrieval_date)).filter(Boolean);
    document.getElementById("last-updated").textContent = dates.sort().pop() || "2026-09-18";

    const defaultYear = fillYearSelectors(ts);
    mapYear = defaultYear;

    // Cada bloque en su propio try/catch: un fallo aislado no debe tumbar el resto.
    const safe = (label, fn) => { try { fn(); } catch (e) { console.error("[obs] fallo en " + label, e); } };
    safe("KPIs", () => renderKPIs(ts));
    safe("serie", () => renderSeries(ts));
    safe("tipos", () => renderTipos(ts));
    safe("correlacion", () => renderCorrelation(correlation));
    safe("mensual", () => renderMonthly(monthly));
    safe("colegios", () => renderSchools(schools));
    safe("buscador-colegios", () => initSchools());
    safe("descargas", () => renderDownloads());
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
    const tiposSeg = document.getElementById("tipos-mode");
    if (tiposSeg) tiposSeg.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
      tiposSeg.querySelectorAll("button").forEach(x => x.classList.remove("active"));
      b.classList.add("active"); tiposMode = b.dataset.mode; renderTipos(store.timeseries);
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
