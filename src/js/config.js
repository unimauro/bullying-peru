/* Configuración global del Observatorio */
window.OBS_CONFIG = {
  // Gateway de IA para el chatbot "Pregúntale al Observatorio".
  // El token X-Client-Token se sirve por el gateway según allowlist de Origin
  // (unimauro.github.io ya está incluido). No se coloca ningún secreto en el repo.
  gateway: {
    url: "https://ai.tunky.net/v1/chat",
    // Si el gateway exige token por header desde el cliente, colócalo aquí SOLO si es
    // un token público de front acotado por Origin. Pídelo a Carlos.
    clientToken: "", // p. ej. "bully_xxx" (acotado por Origin), o "" si el gateway lo inyecta
    model: "claude-haiku-4-5"
  },
  // Paleta semántica (coincide con styles.css)
  colors: {
    bullying: "#e07a3f",
    ciber: "#7c5cbf",
    violencia: "#1f5f8b",
    exposicion: "#0f9d92",
    brand: "#1f5f8b"
  },
  geojson: "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson",
  data: {
    timeseries: "data/processed/timeseries.json",
    byDepartment: "data/processed/by_department.json",
    population: "data/processed/population.json",
    context: "data/processed/context.json",
    legislation: "data/processed/legislation.json",
    news: "data/news/news.json",
    sources: "data/processed/sources.json",
    studies: "data/processed/studies.json",
    breakdowns: "data/processed/breakdowns.json"
  }
};

// Detecta tema para ECharts (respeta prefers-color-scheme)
window.OBS_isDark = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  && document.documentElement.getAttribute("data-theme") !== "light";
