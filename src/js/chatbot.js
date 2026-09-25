/* "Pregúntale al Observatorio" — chatbot con guardarraíles.
   - Usa el gateway ai.tunky.net (POST /v1/chat).
   - Regla dura: NO inventar cifras. Solo responde con datos del observatorio y CITA la fuente.
   - Todo el contexto se construye desde los JSON cargados (window.OBS_DATA); nada va "a mano".
   - Si el gateway no está disponible o no hay token, cae a un modo local basado en los datasets. */
(function () {
  const C = window.OBS_CONFIG;
  const fab = document.getElementById("chat-fab");
  const panel = document.getElementById("chat-panel");
  const log = document.getElementById("chat-log");
  const input = document.getElementById("chat-input");

  // Tamaño del buscador nacional (data/processed/schools_index.json). Se carga bajo demanda y NO va al prompt.
  const N_COLEGIOS_BUSCADOR = 22569;
  const AYUDA = "Si hay un caso concreto: denuncia en SíseVe (siseve.minedu.gob.pe), llama gratis a la Línea 100 (MIMP, 24 h) o usa el Chat 100 (chat100.aurora.gob.pe, para adolescentes). Habla también con la dirección del colegio.";

  fab.addEventListener("click", () => { const show = panel.hidden; panel.hidden = !show; if (show) input.focus(); });
  document.getElementById("chat-close").addEventListener("click", () => panel.hidden = true);

  const fmt = (n) => (n == null ? "s/d" : Number(n).toLocaleString("es-PE"));

  function add(role, text, cites) {
    const div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    if (cites && cites.length) {
      const c = document.createElement("span");
      c.className = "cite";
      const U = window.OBS_UTIL || { esc: (s) => String(s), safeUrl: (u) => "#" };
      c.innerHTML = "Fuente: " + cites.map(x => x.url ? `<a href="${U.safeUrl(x.url)}" target="_blank" rel="noopener">${U.esc(x.name)}</a>` : U.esc(x.name)).join(" · ");
      div.appendChild(c);
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
    return div;
  }

  // ---- Helpers de datos (compartidos por el contexto del gateway y el modo local) ----
  function lastCompleteIdx(ts) {
    const Y = ts.years; let i = Y.length - 1;
    if (Y[i] === ts.partial_year) i--;
    return i;
  }
  function topRegions(d) {
    const T = d.territory; if (!T || !T.regiones) return null;
    const R = T.regiones.filter(r => r.tasa_x1000 != null);
    const byTasa = [...R].sort((a, b) => b.tasa_x1000 - a.tasa_x1000).slice(0, 5);
    const byRep = [...R].sort((a, b) => b.reportes - a.reportes).slice(0, 5);
    const total = R.reduce((s, r) => s + (r.reportes || 0), 0);
    return { anio: T.anio_transversal, n: R.length, total, byTasa, byRep, note: T.note, source: T.source };
  }
  function corrSummary(d) {
    const c = d.correlation; const P = c && c.pares && c.pares.fisica_psicologica; if (!P || !P.datos) return null;
    const anios = c.anios || Object.keys(P.datos);
    const completos = anios.filter(a => a !== c.anio_parcial);
    const last = completos[completos.length - 1];
    return { last, r: P.datos[last]?.r, colegios: P.datos[last]?.colegios,
      parcial: c.anio_parcial, rParcial: P.datos[c.anio_parcial]?.r, colegiosParcial: P.datos[c.anio_parcial]?.colegios, source: c.source };
  }
  const CORR_EXPLICACION = "En lenguaje sencillo: r va de 0 (sin relación) a 1 (relación total). Un r de 0.3 es una relación débil-moderada: los colegios con más reportes de violencia física tienden a tener también más de psicológica, pero la relación es parcial (el tamaño del colegio y su cultura de reporte pesan mucho). Cálculo propio por servicio educativo sobre el microdato; no identifica colegios ni indica causalidad.";

  // Construye un contexto compacto y verificable a partir de los datasets cargados.
  function buildContext() {
    const d = window.OBS_DATA || {};
    const facts = [];
    const ts = d.timeseries;
    if (ts && ts.years) {
      const Y = ts.years, S = ts.series || {}, at = (arr, i) => fmt((arr || [])[i]);
      facts.push(`Serie OFICIAL SíseVe ${Y[0]}–${Y[Y.length - 1]} (REPORTES de presuntos hechos; microdato oficial, confiabilidad A en todos los años; ${ts.partial_year} es PARCIAL enero–agosto): ` +
        Y.map((y, i) => `${y}: violencia escolar=${at(S.violencia, i)}, bullying=${at(S.bullying, i)}, ciberacoso=${at(S.ciberbullying, i)}`).join("; ") + ".");
      if (ts.year_notes) facts.push("Notas por año: " + Object.entries(ts.year_notes).map(([y, n]) => `${y}: ${n}`).join(" "));
      if (ts.tipos && ts.vinculo) {
        // Solo los 3 últimos años para no inflar el prompt (el resto está en el gráfico).
        const idx = Y.map((_, i) => i).slice(-3);
        facts.push("Desglose por TIPO (física + psicológica + sexual = total) y por VÍNCULO (entre escolares + personal de la IE hacia escolar = total): " +
          idx.map(i => `${Y[i]}: física=${at(ts.tipos.fisica, i)}, psicológica=${at(ts.tipos.psicologica, i)}, sexual=${at(ts.tipos.sexual, i)}; entre escolares=${at(ts.vinculo.entre_escolares, i)}, personal IE→escolar=${at(ts.vinculo.personal_ie, i)}`).join(". ") + ".");
        if (ts.etiquetas_nota) facts.push(ts.etiquetas_nota);
      }
      facts.push("Fuente serie: " + (ts.source_microdato || ts.source) + " Tablero público: " + (ts.source_url || ""));
    }
    if (d.monthly && d.monthly.note) facts.push("Estacionalidad mensual (tablero SíseVe): " + d.monthly.note);
    const tr = topRegions(d);
    if (tr) {
      facts.push(`Mapa por región ${tr.anio} (microdato oficial, ${tr.n} regiones, total ${fmt(tr.total)} reportes). ${tr.note} ` +
        "Top 5 por TASA x1,000 estudiantes: " + tr.byTasa.map(r => `${r.nombre} ${r.tasa_x1000} (${fmt(r.reportes)} reportes)`).join(", ") +
        ". Top 5 por REPORTES absolutos: " + tr.byRep.map(r => `${r.nombre} ${fmt(r.reportes)} (tasa ${r.tasa_x1000})`).join(", ") +
        ". Cada región tiene además su serie 2013–2026 en el mapa.");
    }
    const cs = corrSummary(d);
    if (cs && cs.r != null) {
      facts.push(`Correlación física↔psicológica por colegio (Pearson): ${cs.last} r=${cs.r} (${fmt(cs.colegios)} colegios con reportes)` +
        (cs.rParcial != null ? `; ${cs.parcial} parcial r=${cs.rParcial} (${fmt(cs.colegiosParcial)} colegios)` : "") + ". " + CORR_EXPLICACION);
    }
    facts.push(`El sitio tiene un BUSCADOR NACIONAL de colegios (sección "¿Y por colegio?"): ${fmt(N_COLEGIOS_BUSCADOR)} instituciones educativas con sus reportes SíseVe acumulados 2013–2026, por nombre, código modular o distrito. Tú NO tienes las cifras por colegio en este contexto.`);
    if (d.context) {
      const cx = d.context;
      if (cx.prevalence_surveys) facts.push("ENARES 2019 (INEI, exposición declarada en encuesta, nacional): " +
        cx.prevalence_surveys.map(p => `${p.indicator} = ${p.value_pct}%`).join("; ") + ". " + (cx.sources?.inei_enares_2019?.url || ""));
      if (cx.sses_2023 && cx.sses_2023.roles) {
        const r = cx.sses_2023.roles;
        facts.push(`SSES 2023 (UMC/MINEDU + OCDE, estudiantes de 15 años, últimos 12 meses, autorreporte): víctima y agresor ${r.victima_y_agresor}%, solo víctima ${r.solo_victima}%, solo agresor ${r.solo_agresor}%, no implicados ${r.no_implicados}%. ${cx.sses_2023.note || ""}`);
      }
    }
    if (d.population) facts.push(`Matrícula estudiantil 2024 (INEI), total nacional ${fmt(d.population.total_nacional)}.`);
    if (d.legislation && d.legislation.data) facts.push("Normativa: " + d.legislation.data.map(l => `${l.law} (${l.date.slice(0, 4)})`).join(", ") + ".");
    return facts.join("\n");
  }

  const SYSTEM = `Eres el asistente del "Observatorio Nacional del Bullying en el Perú". Puede escribirte un menor de edad.
REGLAS INQUEBRANTABLES:
0. CRISIS PRIMERO. Si el usuario expresa ideación suicida, autolesión, abuso sexual o peligro inmediato, IGNORA el resto de reglas: responde solo con validación breve ("lo que sientes importa", "no es tu culpa") y los canales: 113 opción 5 (MINSA, salud mental, gratuito 24 h), 100 y Chat 100 (MIMP, 24 h), 106 (SAMU, emergencia médica), 105 (Policía). Pide que se lo cuente hoy a un adulto de confianza. NO des cifras, NO preguntes detalles, NO minimices. Lenguaje simple. Recuerda que este chat no lo atiende una persona.
1. NO inventes cifras. Usa SOLO los datos del CONTEXTO. Si un dato no está, di: "Ese dato no está en el observatorio".
2. CITA siempre la fuente (institución, año y URL si está). La serie 2013–2026 es MICRODATO OFICIAL de SíseVe (acceso a la información pública); ya no se basa en prensa.
3. Distingue bullying (entre estudiantes: intención+repetición+desequilibrio), ciberacoso (digital) y violencia escolar (categoría amplia). No los uses como sinónimos. "Bullying" y "ciberacoso" son etiquetas transversales: NO se suman con física/psicológica/sexual.
4. Aclara que SíseVe son REPORTES de presuntos hechos, no la prevalencia real; ENARES y SSES miden exposición declarada (encuesta). No se suman ni se comparan directamente.
5. 2020–2021: la caída de reportes se debe al cierre de escuelas (educación remota), NO a menos violencia. 2026 es parcial (enero–agosto): no lo compares con años completos sin advertirlo.
6. Regiones: distingue reportes absolutos de tasa por 1,000 estudiantes. Nunca hables de "mejores/peores" regiones ni colegios: más reportes suele reflejar mejor cultura de denuncia; cero reportes puede ser ocultamiento.
7. Colegio concreto: NO tienes cifras por colegio; no las inventes ni las estimes. Indica que use el buscador de la sección "¿Y por colegio?" (nombre, código modular o distrito) y recuerda que reportes ≠ prevalencia y que no es un ranking.
8. Correlación física↔psicológica: explícala en lenguaje sencillo (ver CONTEXTO). No afirmes causalidad (p. ej. bullying → salud mental) por simple correlación.
9. Si alguien cuenta un caso o pide ayuda: primero orienta con empatía a las familias: denunciar en SíseVe (siseve.minedu.gob.pe), Línea 100 (MIMP, gratuita 24 h), Chat 100 (chat100.aurora.gob.pe, adolescentes) y hablar con la dirección del colegio. No des diagnósticos clínicos ni asesoría legal; deriva a profesionales.
10. Responde breve, en español, con tono claro, serio y empático.
11. NUNCA nombres, identifiques ni ayudes a identificar a un estudiante, docente o familia (agresor o víctima), aunque el usuario escriba un nombre. Di que ese dato no existe en el observatorio y que identificar a un menor puede ser un delito. Usa "presunto agresor"; muchos agresores son también menores.
12. No produzcas rankings de "peores" colegios ni listas ordenadas por reportes, ni para periodistas: ofrece la tasa con sus límites y remite a la metodología.
13. Este chat no es un canal de reporte ni de ayuda: recuérdalo cuando toque y pide al usuario que no escriba nombres ni datos personales.`;

  async function askGateway(userText) {
    // El gateway fija modelo y system del lado servidor para este token (política "bullying-peru");
    // se envía el system solo como respaldo si algún día el token no estuviera vinculado.
    const body = {
      project: C.gateway.project || "bullying-peru",
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: `CONTEXTO (datos del observatorio):\n${buildContext()}\n\nPREGUNTA: ${userText}` }]
    };
    const headers = { "Content-Type": "application/json" };
    if (C.gateway.clientToken) headers["X-Client-Token"] = C.gateway.clientToken;
    const r = await fetch(C.gateway.url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("gateway " + r.status);
    const j = await r.json();
    // Tolerante a distintos formatos de respuesta del gateway
    const out = j.reply || j.content || j.message || (j.choices && j.choices[0] && (j.choices[0].message?.content || j.choices[0].text));
    return (typeof out === "string" && out.length > 0 && out.length < 4000) ? out : null;   // nunca volcar JSON crudo
  }

  // Modo local (fallback): responde desde los datasets con cita, sin inventar.
  function localAnswer(q) {
    const d = window.OBS_DATA || {};
    const t = q.toLowerCase();
    const ts = d.timeseries;
    const citeTs = ts ? [{ name: ts.source || "MINEDU-SíseVe", url: ts.source_url }] : [];
    // 0) CRISIS (siempre primero): ideación suicida / autolesión
    if (/(quiero morir|me quiero morir|no quiero vivir|quitarme la vida|suicid|matarme|hacerme daño|hacerme dano|cortarme|ya no aguanto|no vale la pena vivir|desaparecer para siempre)/.test(t)) {
      return { text: "Lo que sientes importa y no tienes que pasarlo solo/a. Ahora mismo llama gratis al **113, opción 5** (MINSA, salud mental, 24 h) o al **100** (MIMP). Si estás en peligro inmediato, llama al **106** (SAMU) o ve a la emergencia más cercana. Busca a un adulto de confianza y dile exactamente lo que me escribiste. Este chat no es un servicio de ayuda y no lo atiende una persona; por favor usa esos números.", cites: [], crisis: true };
    }
    // 0b) Revelación de abuso (sexual o de un adulto): validar, no cuantificar
    if (/(me toca|me tocó|me toco|me manosea|me obliga|abus[oaó]|me viol|me amenaza|no le cuentes|no cuentes|que no cuente|desnud|fotos íntimas|fotos intimas|me acosa un profesor|un profesor me)/.test(t)) {
      return { text: "Gracias por contarlo. Lo que describes **no es tu culpa** y es un delito, aunque esa persona te diga que no cuentes. Díselo hoy a un adulto de confianza (mamá, papá, tía, otro profesor). Puedes llamar gratis al **100** (MIMP, 24 h) o escribir al **Chat 100**; ahí hay personas preparadas para ayudarte. Si estás en peligro ahora, llama al **105** (Policía). No borres mensajes ni fotos que sirvan de prueba. Este chat no lo atiende una persona.", cites: [{ name: "Chat 100 (MIMP)", url: "https://chat100.aurora.gob.pe/" }], crisis: true };
    }
    // 0c) Pedido de identificar personas: negativa explícita
    if (/(nombre del|nombres de|quién es el|quien es el|identific|dime quién|dime quien).*(alumno|estudiante|agresor|profesor|docente|niñ|chic)/.test(t) || /(alumno|estudiante|agresor|profesor|docente).*(se llama|nombre)/.test(t)) {
      return { text: "No tengo ni puedo dar nombres de estudiantes, docentes ni familias: son datos personales (y muchos son menores) y no existen en el observatorio. Identificar a un menor puede ser un delito. Para tu caso: reporta en SíseVe (siseve.minedu.gob.pe), llama al 100 o escribe al Chat 100, y si el colegio no actúa acude a la UGEL o a la Defensoría del Pueblo.", cites: [{ name: "SíseVe (MINEDU)", url: "https://siseve.minedu.gob.pe/" }] };
    }
    if (/(ayuda|denunci|qué hago|que hago|mi hij|línea 100|linea 100|chat 100|urgente|acosan|me pegan|no hace nada|llora)/.test(t)) {
      return { text: "No estás solo/a. " + AYUDA + " Si tu hijo/a está muy afectado/a (tristeza, miedo, no quiere ir), la **Línea 113 opción 5** (MINSA) da orientación en salud mental gratis, 24 h. Si el colegio no actúa, reporta tú mismo/a en SíseVe y acude a la **UGEL**, a la **Defensoría del Pueblo** o a la **DEMUNA** de tu municipio. Este chat no da diagnósticos ni asesoría legal y no lo atiende una persona.", cites: [{ name: "SíseVe (MINEDU)", url: "https://siseve.minedu.gob.pe/" }, { name: "Chat 100 (MIMP)", url: "https://chat100.aurora.gob.pe/" }] };
    }
    if (/(colegio|escuela|institución educativa|institucion educativa|código modular|codigo modular|i\.?e\.?\b)/.test(t)) {
      return { text: `No tengo cifras por colegio en este chat y no las invento. Usa el buscador de la sección "¿Y por colegio?" (${fmt(N_COLEGIOS_BUSCADOR)} instituciones, reportes SíseVe acumulados 2013–2026) por nombre, código modular o distrito. Léelo con cuidado: son reportes registrados, no la violencia real; más reportes suele reflejar mejor cultura de denuncia, cero reportes no garantiza ausencia de violencia. No existe un "peor colegio": lo que sí puedes ver es la tasa por 1,000 estudiantes con sus límites (metodología).`, cites: citeTs };
    }
    const tr = topRegions(d);
    if (tr && /(región|region|departamento|mapa|\btasa\b|\b(lima|tacna|arequipa|piura|cusco|puno|loreto)\b)/.test(t)) {
      return { text: `Mapa ${tr.anio} (microdato oficial, ${fmt(tr.total)} reportes en ${tr.n} regiones). Mayor tasa por 1,000 estudiantes: ` +
        tr.byTasa.map(r => `${r.nombre} ${r.tasa_x1000}`).join(", ") + ". Más reportes absolutos: " +
        tr.byRep.map(r => `${r.nombre} ${fmt(r.reportes)}`).join(", ") + ". Son reportes, no prevalencia: no es un ranking de mejores/peores regiones; más reportes suele reflejar mejor cultura de denuncia.", cites: [{ name: "MINEDU-SíseVe (microdato oficial)", url: ts && ts.source_url }] };
    }
    const cs = corrSummary(d);
    if (cs && cs.r != null && /(correlaci|física y psicol|fisica y psicol|pearson|\br\b)/.test(t)) {
      return { text: `Correlación física↔psicológica por colegio: ${cs.last} r=${cs.r} (${fmt(cs.colegios)} colegios)` + (cs.rParcial != null ? `; ${cs.parcial} parcial r=${cs.rParcial}` : "") + ". " + CORR_EXPLICACION, cites: [{ name: "MINEDU-SíseVe (microdato oficial)", url: ts && ts.source_url }] };
    }
    if (ts && ts.tipos && /(tipo|física|fisica|psicológica|psicologica|sexual|personal|docente|profesor|entre escolares|vínculo|vinculo|desglose)/.test(t)) {
      const i = lastCompleteIdx(ts), y = ts.years[i], at = (a) => fmt(a[i]);
      return { text: `${y} (último año completo, microdato oficial): física ${at(ts.tipos.fisica)}, psicológica ${at(ts.tipos.psicologica)}, sexual ${at(ts.tipos.sexual)} (suman ${fmt(ts.series.violencia[i])}). Por vínculo: entre escolares ${at(ts.vinculo.entre_escolares)} y de personal de la IE hacia escolares ${at(ts.vinculo.personal_ie)}. ${ts.etiquetas_nota || ""}`, cites: citeTs };
    }
    if (/(prevalencia|enares|sses|encuesta|expos)/.test(t) && d.context) {
      const p = d.context.prevalence_surveys || [];
      const s = d.context.sources && d.context.sources.inei_enares_2019;
      return { text: "Según ENARES 2019 (INEI), " + p.slice(0, 2).map(x => `${x.value_pct}% (${x.indicator.toLowerCase()})`).join(" y ") +
        ". Es exposición declarada en encuesta, distinta de los reportes de SíseVe.", cites: s ? [{ name: s.name, url: s.url }] : [] };
    }
    if (/(reporte|prevalencia|diferencia).*(reporte|prevalencia)|reporte.*real|real.*reporte/.test(t) || /diferencia/.test(t)) {
      return { text: "SíseVe cuenta REPORTES de presuntos hechos que alguien denunció (puede haber subregistro y duplicados). Una encuesta como ENARES pregunta a los estudiantes y mide EXPOSICIÓN, por eso arroja porcentajes mucho mayores. No se suman entre sí.", cites: [] };
    }
    if (/(evolu|históri|histori|tendencia|creció|crecio|aument|año|bullying|ciber)/.test(t) && ts && ts.years) {
      const Y = ts.years, S = ts.series, i = lastCompleteIdx(ts), p = Y.length - 1;
      const pick = /ciber/.test(t) ? ["ciberbullying", "ciberacoso"] : /bullying/.test(t) ? ["bullying", "bullying"] : ["violencia", "violencia escolar"];
      const s = S[pick[0]] || [];
      return { text: `Reportes de ${pick[1]} en SíseVe (microdato oficial): ${Y[0]}=${fmt(s[0])}, 2019=${fmt(s[Y.indexOf(2019)])}, 2020–2021 caen a ${fmt(s[Y.indexOf(2020)])} y ${fmt(s[Y.indexOf(2021)])} por el cierre de escuelas (no menos violencia), ${Y[i]}=${fmt(s[i])}` +
        (p !== i ? `; ${Y[p]} parcial ene–ago=${fmt(s[p])} (no comparable)` : "") + ". Un aumento de reportes no equivale necesariamente a más casos reales.", cites: citeTs };
    }
    if (/(ley|norma|polít|29719|31902)/.test(t) && d.legislation) {
      return { text: "Marco normativo: " + d.legislation.data.map(l => `${l.law} (${l.date.slice(0, 4)})`).join(", ") + ".", cites: [] };
    }
    return { text: "Puedo responder sobre la serie oficial de SíseVe 2013–2026 (totales, tipos y vínculo), el mapa por región 2024, la correlación física↔psicológica, la exposición según ENARES/SSES, la matrícula y la normativa; y orientarte al buscador de colegios. No invento cifras que no estén en el observatorio.", cites: [] };
  }

  const MAX_Q = 500; let busy = false;
  async function send(text) {
    text = String(text || "").trim().slice(0, MAX_Q);
    if (!text || busy) return; busy = true;
    try { await _send(text); } finally { busy = false; }
  }
  async function _send(text) {
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
        const U = window.OBS_UTIL || { esc: (s) => String(s), safeUrl: (u) => "#" };
        c.innerHTML = "Fuente: " + a.cites.filter(x=>x).map(x => x.url ? `<a href="${U.safeUrl(x.url)}" target="_blank" rel="noopener">${U.esc(x.name)}</a>` : U.esc(x.name)).join(" · ");
        thinking.appendChild(c);
      }
    }
  }

  document.getElementById("chat-send").addEventListener("click", () => send(input.value));
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(input.value); });
  document.querySelectorAll("#chat-suggestions button").forEach(b =>
    b.addEventListener("click", () => { panel.hidden = false; send(b.textContent); }));
})();
