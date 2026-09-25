(function(){
  // A11y: iconos SVG decorativos ocultos para lectores de pantalla
  document.querySelectorAll('svg.ic').forEach(function(s){ s.setAttribute('aria-hidden','true'); s.setAttribute('focusable','false'); });
  // A11y: estado de los toggles de segmento
  function syncSeg(){ document.querySelectorAll('.seg').forEach(function(seg){ seg.setAttribute('role','group'); seg.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', b.classList.contains('active')?'true':'false'); }); }); }
  syncSeg();
  document.querySelectorAll('.seg button').forEach(function(b){ b.addEventListener('click', function(){ setTimeout(syncSeg, 0); }); });
  var sb = document.getElementById('sidebar'), tg = document.getElementById('menu-toggle'), bd = document.getElementById('sidebar-backdrop');
  function open(){ sb.classList.add('open'); bd.hidden = false; }
  function close(){ sb.classList.remove('open'); bd.hidden = true; }
  if (tg) tg.addEventListener('click', function(){ sb.classList.contains('open') ? close() : open(); });
  if (bd) bd.addEventListener('click', close);
  document.querySelectorAll('.side-nav a').forEach(function(a){ a.addEventListener('click', function(){ if (window.innerWidth <= 960) close(); }); });
  // Resaltar sección activa en el scroll
  var links = [].slice.call(document.querySelectorAll('.side-nav a'));
  var map = {}; links.forEach(function(a){ var id = a.getAttribute('href').slice(1); var s = document.getElementById(id); if (s) map[id] = a; });
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if (e.isIntersecting){ links.forEach(function(l){ l.classList.remove('active'); }); var a = map[e.target.id]; if (a) a.classList.add('active'); } });
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(map).forEach(function(id){ obs.observe(document.getElementById(id)); });
})();
