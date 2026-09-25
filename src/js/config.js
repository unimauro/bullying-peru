/* Configuración global del Observatorio */
window.OBS_CONFIG = {
  // Gateway de IA para el chatbot "Pregúntale al Observatorio".
  // clientToken es un token PÚBLICO de front acotado por allowlist de Origin
  // (unimauro.github.io), el mismo que usan los otros observatorios. No es un secreto:
  // el gateway solo acepta peticiones desde los orígenes permitidos.
  gateway: {
    url: "https://ai.tunky.net/v1/chat",
    clientToken: "obs_5356ba138c2761b3c84faf38bd82e4e4",
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
  // GeoJSON vendorizado localmente (evita depender de raw.githubusercontent en runtime).
  // Origen: juaneladio/peru-geojson (MPL-2.0), peru_departamental_simple.geojson.
  geojson: "data/geo/peru-departamental.geojson",
  data: {
    timeseries: "data/processed/timeseries.json",
    byDepartment: "data/processed/by_department.json",
    population: "data/processed/population.json",
    context: "data/processed/context.json",
    legislation: "data/processed/legislation.json",
    news: "data/news/news.json",
    sources: "data/processed/sources.json",
    studies: "data/processed/studies.json",
    breakdowns: "data/processed/breakdowns.json",
    world: "data/processed/world.json",
    books: "data/processed/books.json",
    monthly: "data/processed/monthly.json",
    schools: "data/processed/schools.json",
    territory: "data/processed/territory.json",
    correlation: "data/processed/correlation.json",
    schoolsIndex: "data/processed/schools_index.json",
    schoolsTop: "data/processed/schools_top.json",
    institutionsIndex: "data/processed/institutions_index.json",
    schoolsGeo: "data/processed/schools_geo.json",
    districtsGeo: "data/geo/peru-distrital.geojson",
    pensionDistritos: "data/processed/pension_distritos.json",
    schoolsMatricula: "data/processed/schools_matricula_2024.json"
  }
};

// Detecta tema para ECharts (respeta prefers-color-scheme)
window.OBS_isDark = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
  && document.documentElement.getAttribute("data-theme") !== "light";
