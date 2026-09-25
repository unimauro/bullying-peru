// Google Analytics con Consent Mode: denegado por defecto; se activa solo si el usuario acepta.
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', 'G-YD3GKLZX0T', { anonymize_ip: true });
(function () {
  let pref = null; try { pref = localStorage.getItem('ga_consent'); } catch (e) {}
  if (pref === '1') gtag('consent', 'update', { analytics_storage: 'granted' });
  document.addEventListener('DOMContentLoaded', function () {
    const bar = document.getElementById('privacy-bar'); if (!bar) return;
    if (pref !== '1' && pref !== '0') bar.hidden = false;
    const set = (v) => { try { localStorage.setItem('ga_consent', v); } catch (e) {} if (v === '1') gtag('consent', 'update', { analytics_storage: 'granted' }); bar.hidden = true; };
    const ok = document.getElementById('ga-ok'), no = document.getElementById('ga-no');
    if (ok) ok.addEventListener('click', () => set('1'));
    if (no) no.addEventListener('click', () => set('0'));
  });
})();
