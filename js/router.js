export function createRouter(routes) {
  const parse = () => {
    const hash = location.hash.slice(1) || '/';
    const parts = hash.split('/').filter(Boolean);
    return { hash, parts };
  };
  const match = ({ parts }) => {
    for (const r of routes) {
      const rParts = r.path.split('/').filter(Boolean);
      if (rParts.length !== parts.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < rParts.length; i++) {
        if (rParts[i].startsWith(':')) {
          params[rParts[i].slice(1)] = decodeURIComponent(parts[i]);
        } else if (rParts[i] !== parts[i]) { ok = false; break; }
      }
      if (ok) return { ...r, params };
    }
    return routes.find(r => r.path === '/');
  };
  const notify = () => {
    const state = parse();
    const route = match(state);
    route?.onEnter?.(route.params || {});
  };
  window.addEventListener('hashchange', notify);
  document.addEventListener('DOMContentLoaded', notify);
  return { go: (hash) => { location.hash = hash; } };
}
