/* "Pregúntale al Observatorio" — chatbot con guardarraíles.
   - Usa el gateway ai.tunky.net (POST /v1/chat).
   - Regla dura: NO inventar cifras. Solo responde con datos del observatorio y CITA la fuente.
   - Si el gateway no está disponible o no hay token, cae a un modo local basado en los datasets. */
(function () {
  const C = window.OBS_CONFIG;
  const fab = document.getElementById("chat-fab");
  const panel = document.getElementById("chat-panel");
  const log = document.getElementById("chat-log");
  const input = document.getElementById("chat-input");

  fab.addEventListener("click", () => { const show = panel.hidden; panel.hidden = !show; if (show) input.focus(); });
  document.getElementById("chat-close").addEventListener("click", () => panel.hidden = true);

  function add(role, text, cites) {
    const div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    if (cites && cites.length) {
      const c = document.createElement("span");
      c.className = "cite";
      c.innerHTML = "Fuente: " + cites.map(x => x.url ? `<a href="${x.url}" target="_blank" rel="noopener">${x.name}</a>` : x.name).join(" · ");
      div.appendChild(c);
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // Construye un contexto compacto y verificable a partir de los datasets cargados.
  function buildContext() {
    const d = window.OBS_DATA || {};
    const facts = [];
    if (d.timeseries && d.timeseries.years) {
      facts.push("Serie SíseVe (reportes) por año: " + d.timeseries.years.map((y, i) =>
        `${y}: viol.escolar=${(d.timeseries.series.violencia||[])[i] ?? "s/d"}, bullying=${(d.timeseries.series.bullying||[])[i] ?? "s/d"}, ciber=${(d.timeseries.series.ciberbullying||[])[i] ?? "s/d"}`).join("; ") +
        ". Fuente: " + (d.timeseries.source || "MINEDU-SíseVe") + " " + (d.timeseries.source_url || ""));
    }
    if (d.context && d.context.prevalence_surveys) {
      facts.push("ENARES 2019 (exposición declarada, INEI): " +
        d.context.prevalence_surveys.map(p => `${p.indicator} = ${p.value_pct}%`).join("; ") + ".");
    }
    if (d.population) facts.push(`Matrícula estudiantil 2024 (INEI), total nacional ${d.population.total_nacional}.`);
    if (d.legislation && d.legislation.data) facts.push("Normativa: " + d.legislation.data.map(l => `${l.law} (${l.date.slice(0,4)})`).join(", ") + ".");
    return facts.join("\n");
  }

  const SYSTEM = `Eres el asistente del "Observatorio Nacional del Bullying en el Perú".
REGLAS INQUEBRANTABLES:
1. NO inventes cifras. Usa SOLO los datos del CONTEXTO. Si un dato no está, di: "Ese dato no está en el observatorio".
2. CITA siempre la fuente (institución, año y URL si está).
3. Distingue bullying (entre estudiantes: intención+repetición+desequilibrio), ciberbullying (digital) y violencia escolar (categoría amplia). No los uses como sinónimos.
4. Aclara que SíseVe son REPORTES de presuntos hechos, no la prevalencia real; y que ENARES mide exposición declarada (encuesta).
5. No afirmes causalidad (p. ej. bullying → salud mental) por simple correlación.
6. Responde breve, en español, con tono claro y serio.`;

  async function askGateway(userText) {
    const body = {
      model: C.gateway.model,
      system: SYSTEM,
      messages: [{ role: "user", content: `CONTEXTO (datos del observatorio):\n${buildContext()}\n\nPREGUNTA: ${userText}` }]
    };
    const headers = { "Content-Type": "application/json" };
    if (C.gateway.clientToken) headers["X-Client-Token"] = C.gateway.clientToken;
    const r = await fetch(C.gateway.url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("gateway " + r.status);
    const j = await r.json();
    // Tolerante a distintos formatos de respuesta del gateway
    return j.reply || j.content || j.message || (j.choices && j.choices[0] && (j.choices[0].message?.content || j.choices[0].text)) || JSON.stringify(j);
  }

  // Modo local (fallback): responde desde los datasets con cita, sin inventar.
  function localAnswer(q) {
    const d = window.OBS_DATA || {};
    const t = q.toLowerCase();
    if (/(prevalencia|enares|encuesta|expos)/.test(t) && d.context) {
      const p = d.context.prevalence_surveys || [];
      const s = d.context.sources && d.context.sources.inei_enares_2019;
      return { text: "Según ENARES 2019 (INEI), " + p.slice(0, 2).map(x => `${x.value_pct}% (${x.indicator.toLowerCase()})`).join(" y ") +
        ". Es exposición declarada en encuesta, distinta de los reportes de SíseVe.", cites: s ? [{ name: s.name, url: s.url }] : [] };
    }
    if (/(reporte|prevalencia|diferencia).*(reporte|prevalencia)|reporte.*real|real.*reporte/.test(t) || /diferencia/.test(t)) {
      return { text: "SíseVe cuenta REPORTES de presuntos hechos que alguien denunció (puede haber subregistro y duplicados). Una encuesta como ENARES pregunta a los estudiantes y mide EXPOSICIÓN, por eso arroja porcentajes mucho mayores. No se suman entre sí.", cites: [] };
    }
    if (/(evolu|históri|tendencia|creció|aument|año)/.test(t) && d.timeseries && d.timeseries.years) {
      const y = d.timeseries.years, s = d.timeseries.series.violencia || [];
      return { text: `Reportes de violencia escolar en SíseVe: ${y[0]}=${s[0] ?? "s/d"} → ${y[y.length-1]}=${s[s.length-1] ?? "s/d"}. Recuerda que un aumento de reportes no equivale necesariamente a más casos reales.`, cites: [{ name: d.timeseries.source || "MINEDU-SíseVe", url: d.timeseries.source_url }] };
    }
    if (/(ley|norma|polít|29719|31902)/.test(t) && d.legislation) {
      return { text: "Marco normativo: " + d.legislation.data.map(l => `${l.law} (${l.date.slice(0,4)})`).join(", ") + ".", cites: [] };
    }
    return { text: "Puedo responder sobre la serie de SíseVe, la prevalencia de ENARES, la matrícula y la normativa. Reformula tu pregunta hacia esos datos; no invento cifras que no estén en el observatorio.", cites: [] };
  }

  async function send(text) {
    if (!text.trim()) return;
    add("user", text);
    input.value = "";
    const thinking = add("bot", "…");
    try {
      const reply = await askGateway(text);
      thinking.textContent = reply;
    } catch (e) {
      console.warn("[chat] gateway no disponible, modo local:", e.message);
      const a = localAnswer(text);
      thinking.textContent = a.text;
      if (a.cites && a.cites.length) {
        const c = document.createElement("span"); c.className = "cite";
        c.innerHTML = "Fuente: " + a.cites.filter(x=>x).map(x => x.url ? `<a href="${x.url}" target="_blank" rel="noopener">${x.name}</a>` : x.name).join(" · ");
        thinking.appendChild(c);
      }
    }
  }

  document.getElementById("chat-send").addEventListener("click", () => send(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(input.value); });
  document.querySelectorAll("#chat-suggestions button").forEach(b =>
    b.addEventListener("click", () => { panel.hidden = false; send(b.textContent); }));
})();
