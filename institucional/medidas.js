const guide = document.querySelector('.sg-page');
if (guide) {
  const groups = [...guide.querySelectorAll('[data-sg-category]')];
  const filters = [...guide.querySelectorAll('[data-sg-filter]')];
  function applyFilter(category = 'todos') {
    for (const group of groups) group.hidden = category !== 'todos' && group.dataset.sgCategory !== category;
    for (const filter of filters) {
      if (filter.dataset.sgFilter === category) filter.setAttribute('aria-current', 'true');
      else filter.removeAttribute('aria-current');
    }
  }
  function followHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    const category = target?.closest('[data-sg-category]');
    applyFilter(category?.dataset.sgCategory);
    if (category) target.scrollIntoView({ block:'start' });
  }
  for (const filter of filters) {
    filter.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      applyFilter(filter.dataset.sgFilter);
      if (location.hash !== filter.hash) history.pushState(null, '', filter.hash);
    });
  }
  // Enable anchors from the model index even if a different category was filtered.
  guide.querySelector('.sg-index')?.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.getElementById(link.hash.slice(1));
    if (target) applyFilter(target.closest('[data-sg-category]')?.dataset.sgCategory);
  });
  window.addEventListener('hashchange', followHash);
  followHash();
}
