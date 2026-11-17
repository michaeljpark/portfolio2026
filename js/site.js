/* Shared by every page: the light / dark switch in the header.
   The initial theme is set by the inline script in <head> to avoid a flash. */
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('theme');
  const label = document.getElementById('themeLabel');
  if (!btn) return;
  function sync() {
    const dark = root.getAttribute('data-theme') === 'dark';
    label.textContent = dark ? 'Light' : 'Dark';
    btn.setAttribute('aria-pressed', String(dark));
  }
  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    sync();
  });
  sync();
})();
