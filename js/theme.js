/* Applies the saved Light/Dark choice before the page draws, so it never flashes.
   Loaded in <head> of every page. Default comes from content/site.json -> theme.default */
(function () {
  var saved = null;
  try { saved = localStorage.getItem('vs-theme'); } catch (e) { /* private mode */ }
  var root = document.documentElement;
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
})();
